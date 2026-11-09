import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserSet } from '../generated/prisma/client';
import { getCoinName, meetsMinGrade } from '@coin-collector/shared';
import type {
  CanonicalSetDetail,
  CanonicalSetSummary,
  CatalogCoin,
  CoinGrade,
  GapSlot,
  GapViewResponse,
  PaginatedResponse,
  PublicSetSummary,
  SuggestedCanonicalSet,
  UserSetCoinSummary,
  UserSetDetail,
  UserSetListItem,
  UserSetsSummaryResponse,
  UserSetSummary,
} from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CATALOG_COIN_SELECT } from '../catalog/catalog.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { PatchSetCoinsDto } from './dto/patch-set-coins.dto';
import { FindPublicSetsQueryDto } from './dto/find-public-sets-query.dto';

const MAX_LIMIT = 100;

// Most owned coins first; ties by name, then id, so the suggestion is deterministic.
function compareSuggestions(a: SuggestedCanonicalSet, b: SuggestedCanonicalSet): number {
  if (a.ownedCount !== b.ownedCount) return b.ownedCount - a.ownedCount;
  const byName = a.name.localeCompare(b.name, 'en');
  if (byName !== 0) return byName;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** One gap-view slot before counting: its own id/position, the coin exactly as it is returned,
 *  and the caller's Ownership row for that coin (null when the caller doesn't own it). */
export interface GapSlotSource {
  id: string;
  position: number;
  coin: CatalogCoin;
  ownership: { grade: CoinGrade | null } | null;
}

/** Shared slot/count/percent rules for every gap view (GET /sets/:id/gaps and
 *  GET /sets/canonical/:id/gaps). Sources must already be sorted by position. */
export function buildGapView(
  setId: string,
  minGrade: CoinGrade | null,
  sources: GapSlotSource[],
): GapViewResponse {
  const totalCount = sources.length;
  // needsUpgrade/upgradeCount are present only when the set has a minGrade (shared GapSlot docs).
  const slots: GapSlot[] = sources.map((src) => {
    const owned = src.ownership !== null;
    const grade = src.ownership?.grade ?? null;
    return {
      id: src.id,
      position: src.position,
      coin: src.coin,
      owned,
      grade,
      ...(minGrade !== null ? { needsUpgrade: owned && !meetsMinGrade(grade, minGrade) } : {}),
    };
  });
  // Grades never affect the counts or completion.
  const ownedCount = slots.filter((s) => s.owned).length;
  const completionPercent = totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);

  return {
    setId,
    ownedCount,
    totalCount,
    completionPercent,
    minGrade,
    ...(minGrade !== null
      ? { upgradeCount: slots.filter((s) => s.needsUpgrade === true).length }
      : {}),
    slots,
  };
}

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<UserSetListItem[]> {
    const rows = await this.prisma.userSet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        coins: {
          orderBy: { position: 'asc' },
          select: {
            coinId: true,
            coin: {
              select: {
                country: true,
                denomination: true,
                year: true,
                mintMark: true,
                variety: true,
                name: true,
                isKeyDate: true,
                ownerships: { where: { userId }, select: { coinId: true } },
              },
            },
          },
        },
      },
    });

    return rows.map(({ coins, ...set }) => {
      const firstUnowned = coins.find((slot) => slot.coin.ownerships.length === 0);
      return {
        ...set,
        ownedCount: coins.filter((slot) => slot.coin.ownerships.length > 0).length,
        totalCount: coins.length,
        firstMissing: firstUnowned ? getCoinName(firstUnowned.coin).title : null,
      };
    });
  }

  async getSummary(userId: string): Promise<UserSetsSummaryResponse> {
    const [missingSlots, collectionCount, userSets, ownedChecklistCoins, checklists] =
      await Promise.all([
        this.prisma.userSetCoin.findMany({
          where: { userSet: { userId }, coin: { ownerships: { none: { userId } } } },
          select: { coinId: true },
        }),
        this.prisma.ownership.count({ where: { userId } }),
        this.prisma.userSet.findMany({
          where: { userId },
          select: { clonedFromCanonicalId: true },
        }),
        this.prisma.canonicalSetCoin.findMany({
          where: { coin: { ownerships: { some: { userId } } } },
          select: { canonicalSetId: true },
        }),
        this.findAllCanonical(),
      ]);

    // Deduped here, not in SQL: a coin missing from two of the caller's sets counts once.
    const uniqueMissingCount = new Set(missingSlots.map((slot) => slot.coinId)).size;

    const alreadyCloned = new Set(
      userSets
        .map((set) => set.clonedFromCanonicalId)
        .filter((id): id is string => id !== null),
    );

    // One row per distinct owned coin in a checklist (@@unique([canonicalSetId, coinId])).
    const ownedPerChecklist = new Map<string, number>();
    for (const row of ownedChecklistCoins) {
      ownedPerChecklist.set(row.canonicalSetId, (ownedPerChecklist.get(row.canonicalSetId) ?? 0) + 1);
    }

    let suggestedSet: SuggestedCanonicalSet | null = null;
    for (const checklist of checklists) {
      const owned = ownedPerChecklist.get(checklist.id) ?? 0;
      if (owned === 0 || alreadyCloned.has(checklist.id)) continue;
      const candidate: SuggestedCanonicalSet = {
        id: checklist.id,
        name: checklist.name,
        coinCount: checklist.coinCount,
        ownedCount: owned,
      };
      if (!suggestedSet || compareSuggestions(candidate, suggestedSet) < 0) {
        suggestedSet = candidate;
      }
    }

    return { uniqueMissingCount, collectionCount, suggestedSet };
  }

  async create(userId: string, dto: CreateSetDto): Promise<UserSetSummary> {
    if (!dto.cloneFrom) {
      return this.prisma.userSet.create({
        data: {
          userId,
          name: dto.name,
          clonedFromCanonicalId: null,
          clonedFromUserSetId: null,
        },
      });
    }

    const { type, id } = dto.cloneFrom;

    return this.prisma.$transaction(async (tx) => {
      const sourceCoins =
        type === 'canonical'
          ? await tx.canonicalSetCoin.findMany({ where: { canonicalSetId: id } })
          : await tx.userSetCoin.findMany({ where: { userSetId: id } });

      const created = await tx.userSet.create({
        data: {
          userId,
          name: dto.name,
          clonedFromCanonicalId: type === 'canonical' ? id : null,
          clonedFromUserSetId: type === 'user' ? id : null,
        },
      });

      if (sourceCoins.length > 0) {
        await tx.userSetCoin.createMany({
          data: sourceCoins.map((coin) => ({
            userSetId: created.id,
            coinId: coin.coinId,
            position: coin.position,
          })),
        });
      }

      return created;
    });
  }

  async update(userId: string, id: string, dto: UpdateSetDto): Promise<UserSetSummary> {
    // Empty body: 400 before any Prisma call (the DTO allows {}; at least one key is required).
    if (dto.name === undefined && dto.minGrade === undefined) {
      throw new BadRequestException('Send name and/or minGrade');
    }
    await this.getOwnedSetOrThrow(userId, id);
    return this.prisma.userSet.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.minGrade !== undefined ? { minGrade: dto.minGrade } : {}),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedSetOrThrow(userId, id);
    await this.prisma.userSet.delete({ where: { id } });
  }

  async patchCoins(
    userId: string,
    id: string,
    dto: PatchSetCoinsDto,
  ): Promise<UserSetCoinSummary[]> {
    await this.getOwnedSetOrThrow(userId, id);

    const toAdd = dto.add ? [...new Set(dto.add)] : [];
    const toRemove = dto.remove ?? [];

    if (toAdd.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        const maxPositionResult = await tx.userSetCoin.aggregate({
          where: { userSetId: id },
          _max: { position: true },
        });
        const nextPosition = (maxPositionResult._max.position ?? 0) + 1;

        await tx.userSetCoin.createMany({
          data: toAdd.map((coinId, index) => ({
            userSetId: id,
            coinId,
            position: nextPosition + index,
          })),
          skipDuplicates: true,
        });
      });
    }

    if (toRemove.length > 0) {
      await this.prisma.userSetCoin.deleteMany({
        where: { userSetId: id, coinId: { in: toRemove } },
      });
    }

    return this.prisma.userSetCoin.findMany({
      where: { userSetId: id },
      orderBy: { position: 'asc' },
    });
  }

  async findAllCanonical(): Promise<CanonicalSetSummary[]> {
    const rows = await this.prisma.canonicalSet.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { coins: true } } },
    });
    return rows.map(({ _count, ...set }) => ({ ...set, coinCount: _count.coins }));
  }

  async findCanonicalById(id: string): Promise<CanonicalSetDetail> {
    const set = await this.prisma.canonicalSet.findUnique({
      where: { id },
      include: { coins: { orderBy: { position: 'asc' }, include: { coin: true } } },
    });
    if (!set) {
      throw new NotFoundException('Canonical set not found');
    }
    return set;
  }

  async findAllPublic(query: FindPublicSetsQueryDto): Promise<PaginatedResponse<PublicSetSummary>> {
    const page = query.page;
    const limit = Math.min(query.limit, MAX_LIMIT);

    const [rows, total] = await Promise.all([
      this.prisma.userSet.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { coins: true } } },
      }),
      this.prisma.userSet.count(),
    ]);

    const items = rows.map(({ _count, ...set }) => ({ ...set, coinCount: _count.coins }));
    return { items, page, limit, total };
  }

  async findPublicById(id: string): Promise<UserSetDetail> {
    const set = await this.prisma.userSet.findUnique({
      where: { id },
      include: { coins: { orderBy: { position: 'asc' }, include: { coin: true } } },
    });
    if (!set) {
      throw new NotFoundException('Set not found');
    }
    return set;
  }

  async getGaps(callerId: string, setId: string): Promise<GapViewResponse> {
    const set = await this.prisma.userSet.findUnique({
      where: { id: setId },
      select: {
        id: true,
        minGrade: true,
        coins: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            coin: {
              select: {
                ...CATALOG_COIN_SELECT,
                ownerships: { where: { userId: callerId }, select: { grade: true } },
              },
            },
          },
        },
      },
    });
    if (!set) {
      throw new NotFoundException('Set not found');
    }

    return buildGapView(
      setId,
      set.minGrade,
      set.coins.map(({ id, position, coin: { ownerships, ...coin } }) => ({
        id,
        position,
        coin,
        ownership: ownerships[0] ?? null,
      })),
    );
  }

  async getCanonicalGaps(callerId: string, checklistId: string): Promise<GapViewResponse> {
    const set = await this.prisma.canonicalSet.findUnique({
      where: { id: checklistId },
      select: {
        id: true,
        coins: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            coin: {
              select: {
                ...CATALOG_COIN_SELECT,
                ownerships: { where: { userId: callerId }, select: { grade: true } },
              },
            },
          },
        },
      },
    });
    if (!set) {
      throw new NotFoundException('Canonical set not found');
    }

    // Checklists have no minGrade, so the view carries no upgrade fields.
    return buildGapView(
      checklistId,
      null,
      set.coins.map(({ id, position, coin: { ownerships, ...coin } }) => ({
        id,
        position,
        coin,
        ownership: ownerships[0] ?? null,
      })),
    );
  }

  private async getOwnedSetOrThrow(userId: string, id: string): Promise<UserSet> {
    const set = await this.prisma.userSet.findUnique({ where: { id } });
    if (!set) {
      throw new NotFoundException('Set not found');
    }
    if (set.userId !== userId) {
      throw new ForbiddenException('You do not own this set');
    }
    return set;
  }
}
