import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminCoin, AdminCoinDuplicate, AdminCoinListItem, PaginatedResponse } from '@coin-collector/shared';
import { CATALOG_COIN_SELECT } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { FindAdminCoinsQueryDto } from './dto/find-admin-coins-query.dto';
import { ReviewCoinDto } from './dto/review-coin.dto';

const MAX_LIMIT = 100;

const ALREADY_REVIEWED_MESSAGE = 'This coin has already been reviewed';
const NATURAL_KEY_CONFLICT_MESSAGE = 'A coin with this natural key already exists';

// The catalog column set plus what only an admin may see: the rejection reason and the
// submitter's email (through the relation). Never the submitter id column.
const ADMIN_COIN_SELECT = {
  ...CATALOG_COIN_SELECT,
  rejectionReason: true,
  submitter: { select: { email: true } },
} satisfies Prisma.CoinSelect;

const DUPLICATE_CANDIDATE_SELECT = {
  id: true,
  name: true,
  country: true,
  denomination: true,
  year: true,
  mintMark: true,
  variety: true,
} satisfies Prisma.CoinSelect;

type AdminCoinRow = Prisma.CoinGetPayload<{ select: typeof ADMIN_COIN_SELECT }>;
type DuplicateCandidate = Prisma.CoinGetPayload<{ select: typeof DUPLICATE_CANDIDATE_SELECT }>;
type IdentityKey = Pick<DuplicateCandidate, 'country' | 'denomination' | 'year' | 'mintMark' | 'variety'>;

// The only coin columns an admin may change while reviewing.
const EDITABLE_FIELDS = ['country', 'denomination', 'name', 'year', 'mintMark', 'variety'] as const;

function toAdminCoin(row: AdminCoinRow): AdminCoin {
  const { submitter, ...rest } = row;
  return { ...rest, submitterEmail: submitter?.email ?? null };
}

// Same rule as the POST /catalog dedupe: country/denomination case-insensitive, the rest exact.
function sameIdentity(a: IdentityKey, b: IdentityKey): boolean {
  return (
    a.country.toLowerCase() === b.country.toLowerCase() &&
    a.denomination.toLowerCase() === b.denomination.toLowerCase() &&
    a.year === b.year &&
    a.mintMark === b.mintMark &&
    a.variety === b.variety
  );
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findCoins(query: FindAdminCoinsQueryDto): Promise<PaginatedResponse<AdminCoinListItem>> {
    const page = query.page;
    const limit = Math.min(query.limit, MAX_LIMIT);
    const where: Prisma.CoinWhereInput = { status: query.status };

    const [rows, total] = await Promise.all([
      this.prisma.coin.findMany({
        where,
        select: ADMIN_COIN_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coin.count({ where }),
    ]);

    const coins = rows.map(toAdminCoin);
    const duplicates = await this.findPossibleDuplicates(coins);
    const items = coins.map((coin) => ({ ...coin, possibleDuplicate: duplicates.get(coin.id) ?? null }));

    return { items, page, limit, total };
  }

  async reviewCoin(id: string, dto: ReviewCoinDto): Promise<AdminCoin> {
    if (dto.status === 'approved' && dto.rejectionReason != null) {
      throw new BadRequestException('rejectionReason is only allowed when status is rejected');
    }

    const existing = await this.prisma.coin.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) {
      throw new NotFoundException('Coin not found');
    }
    if (existing.status !== 'pending') {
      throw new ConflictException(ALREADY_REVIEWED_MESSAGE);
    }

    // Built field by field from the DTO, so nothing else (e.g. the submitter id column) is writable.
    const data: Prisma.CoinUpdateInput = {
      status: dto.status,
      rejectionReason: dto.status === 'rejected' ? dto.rejectionReason || null : null,
    };
    for (const field of EDITABLE_FIELDS) {
      const value = dto[field];
      if (value !== undefined) {
        (data as Record<string, unknown>)[field] = value;
      }
    }

    try {
      // `status: 'pending'` in the where makes the update conditional, so a concurrent review
      // that got there first surfaces as P2025 instead of being silently overwritten.
      const row = await this.prisma.coin.update({
        where: { id, status: 'pending' },
        data,
        select: ADMIN_COIN_SELECT,
      });
      return toAdminCoin(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException(NATURAL_KEY_CONFLICT_MESSAGE);
        }
        if (err.code === 'P2025') {
          throw new ConflictException(ALREADY_REVIEWED_MESSAGE);
        }
      }
      throw err;
    }
  }

  // One query for the whole page: approved coins (other than the listed ones) sharing an
  // item's identity key. Advisory only; it never blocks a decision.
  private async findPossibleDuplicates(
    coins: Array<AdminCoin & IdentityKey>,
  ): Promise<Map<string, AdminCoinDuplicate>> {
    const result = new Map<string, AdminCoinDuplicate>();
    if (coins.length === 0) {
      return result;
    }

    const candidates = await this.prisma.coin.findMany({
      where: {
        status: 'approved',
        id: { notIn: coins.map((coin) => coin.id) },
        OR: coins.map((coin) => ({
          country: { equals: coin.country, mode: 'insensitive' as const },
          denomination: { equals: coin.denomination, mode: 'insensitive' as const },
          year: coin.year,
          mintMark: coin.mintMark,
          variety: coin.variety,
        })),
      },
      select: DUPLICATE_CANDIDATE_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    for (const coin of coins) {
      const match = candidates.find((candidate) => sameIdentity(coin, candidate));
      if (match) {
        result.set(coin.id, { id: match.id, name: match.name });
      }
    }
    return result;
  }
}
