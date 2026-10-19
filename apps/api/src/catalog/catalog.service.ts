import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { compareDenominations } from '@coin-collector/shared';
import type {
  CatalogCoin,
  CatalogFacets,
  CatalogListItem,
  CatalogSort,
  PaginatedResponse,
  SubmittedCoin,
} from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { CreateCoinDto } from './dto/create-coin.dto';

const MAX_LIMIT = 100;

// Every read path returns this exact column set — never submittedByUserId. GET /catalog/:id
// is public and unauthenticated (System Design §4.7), so a raw submitter id here would leak
// identity the same way an unguarded POST /catalog response would (backlog 1.4).
// Exported so AdminService builds on the same column set. It must never include
// rejectionReason either: GET /catalog/:id returns coins of any status.
export const CATALOG_COIN_SELECT = {
  id: true,
  country: true,
  denomination: true,
  year: true,
  mintMark: true,
  variety: true,
  name: true,
  imageUrl: true,
  imageSource: true,
  imageLicense: true,
  diameterMm: true,
  weightG: true,
  thicknessMm: true,
  material: true,
  mintage: true,
  isKeyDate: true,
  status: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CoinSelect;

// Used only on the `submittedByMe` branch of findAll, where every row belongs to the caller,
// so the submitter (and nobody else) sees why their coin was rejected.
export const SUBMITTED_COIN_SELECT = { ...CATALOG_COIN_SELECT, rejectionReason: true } satisfies Prisma.CoinSelect;

// Every sort ends on id so pagination is stable.
const SORT_ORDER: Record<CatalogSort, Prisma.CoinOrderByWithRelationInput[]> = {
  year_asc: [{ year: 'asc' }, { id: 'asc' }],
  year_desc: [{ year: 'desc' }, { id: 'asc' }],
  name_asc: [{ name: 'asc' }, { year: 'asc' }, { id: 'asc' }],
};

function normaliseDenominations(value: string | string[] | undefined): string[] {
  const list = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return list.map((entry) => entry.trim()).filter((entry) => entry !== '');
}

function denominationClause(denominations: string[]): Prisma.CoinWhereInput {
  if (denominations.length === 0) return {};
  if (denominations.length === 1) {
    return { denomination: { equals: denominations[0], mode: 'insensitive' as const } };
  }
  return {
    OR: denominations.map((denomination) => ({
      denomination: { equals: denomination, mode: 'insensitive' as const },
    })),
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: FindCatalogQueryDto,
    userId?: string,
  ): Promise<PaginatedResponse<CatalogListItem | SubmittedCoin>> {
    const page = query.page;
    const limit = Math.min(query.limit, MAX_LIMIT);
    const ownSubmissions = Boolean(query.submittedByMe && userId);

    const where: Prisma.CoinWhereInput = {
      ...(ownSubmissions ? { submittedByUserId: userId } : { status: 'approved' }),
      ...(query.country ? { country: { equals: query.country, mode: 'insensitive' as const } } : {}),
      ...denominationClause(normaliseDenominations(query.denomination)),
      ...(query.name ? { name: { contains: query.name, mode: 'insensitive' as const } } : {}),
      ...(query.yearMin !== undefined || query.yearMax !== undefined
        ? {
            year: {
              ...(query.yearMin !== undefined ? { gte: query.yearMin } : {}),
              ...(query.yearMax !== undefined ? { lte: query.yearMax } : {}),
            },
          }
        : {}),
      ...(query.keyDateOnly === true ? { isKeyDate: true } : {}),
      // Like submittedByMe, only honoured for an authenticated caller.
      ...(query.hideOwned === true && userId ? { ownerships: { none: { userId } } } : {}),
    };

    const listArgs = {
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: SORT_ORDER[query.sort ?? 'year_asc'],
    } satisfies Prisma.CoinFindManyArgs;

    // Two explicit calls (rather than one call with a conditional `select`) keep each
    // branch's Prisma payload type precise.
    const itemsQuery: Promise<Array<CatalogCoin | SubmittedCoin>> = ownSubmissions
      ? this.prisma.coin.findMany({ ...listArgs, select: SUBMITTED_COIN_SELECT })
      : this.prisma.coin.findMany({ ...listArgs, select: CATALOG_COIN_SELECT });

    const [items, total] = await Promise.all([itemsQuery, this.prisma.coin.count({ where })]);

    // Anonymous callers get the rows exactly as selected: no viewer keys at all.
    if (!userId) {
      return { items, page, limit, total };
    }

    return { items: await this.addViewerFields(items, userId), page, limit, total };
  }

  // Signed-in only: `owned` and `inSetsCount` for every item of the page, from two batched
  // queries keyed by the page's coin ids, so the query count doesn't grow with the page size.
  private async addViewerFields<T extends CatalogCoin>(
    items: T[],
    userId: string,
  ): Promise<Array<T & { owned: boolean; inSetsCount: number }>> {
    if (items.length === 0) return [];

    const coinIds = items.map((coin) => coin.id);
    const [ownedRows, membershipRows] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { userId, coinId: { in: coinIds } },
        select: { coinId: true },
      }),
      // Only the caller's own user sets; canonical sets live in CanonicalSetCoin. UserSetCoin
      // is unique per (userSetId, coinId), so each row is one distinct set.
      this.prisma.userSetCoin.findMany({
        where: { coinId: { in: coinIds }, userSet: { userId } },
        select: { coinId: true },
      }),
    ]);

    const ownedIds = new Set(ownedRows.map((row) => row.coinId));
    const setCounts = new Map<string, number>();
    for (const row of membershipRows) {
      setCounts.set(row.coinId, (setCounts.get(row.coinId) ?? 0) + 1);
    }

    return items.map((coin) => ({
      ...coin,
      owned: ownedIds.has(coin.id),
      inSetsCount: setCounts.get(coin.id) ?? 0,
    }));
  }

  // Option lists for the catalog sidebar. These selects return a single column each, never a
  // coin row, so CATALOG_COIN_SELECT doesn't apply.
  async findFacets(country?: string): Promise<CatalogFacets> {
    const scopedCountry = country?.trim();
    const [countryRows, denominationRows] = await Promise.all([
      this.prisma.coin.findMany({
        where: { status: 'approved' },
        distinct: ['country'],
        select: { country: true },
      }),
      this.prisma.coin.findMany({
        where: {
          status: 'approved',
          ...(scopedCountry ? { country: { equals: scopedCountry, mode: 'insensitive' as const } } : {}),
        },
        distinct: ['denomination'],
        select: { denomination: true },
      }),
    ]);

    return {
      countries: countryRows.map((row) => row.country).sort((a, b) => a.localeCompare(b, 'en')),
      denominations: denominationRows.map((row) => row.denomination).sort(compareDenominations),
    };
  }

  async findOne(id: string): Promise<CatalogCoin> {
    const coin = await this.prisma.coin.findUnique({ where: { id }, select: CATALOG_COIN_SELECT });
    if (!coin) {
      throw new NotFoundException('Coin not found');
    }
    return coin;
  }

  async create(userId: string, dto: CreateCoinDto): Promise<CatalogCoin> {
    const dedupeWhere: Prisma.CoinWhereInput = {
      country: { equals: dto.country, mode: 'insensitive' as const },
      denomination: { equals: dto.denomination, mode: 'insensitive' as const },
      year: dto.year,
      mintMark: dto.mintMark ?? '',
      variety: dto.variety ?? '',
    };

    const existing = await this.prisma.coin.findFirst({ where: dedupeWhere });
    if (existing) {
      throw new ConflictException('A coin with this natural key already exists');
    }

    try {
      return await this.prisma.coin.create({
        data: {
          country: dto.country,
          denomination: dto.denomination,
          year: dto.year,
          mintMark: dto.mintMark ?? '',
          variety: dto.variety ?? '',
          name: dto.name,
          status: 'pending',
          submittedByUserId: userId,
          submittedAt: new Date(),
        },
        select: CATALOG_COIN_SELECT,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A coin with this natural key already exists');
      }
      throw err;
    }
  }
}
