import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserSet } from '@prisma/client';
import type {
  CanonicalSetDetail,
  CanonicalSetSummary,
  PaginatedResponse,
  UserSetCoinSummary,
  UserSetDetail,
  UserSetSummary,
} from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { PatchSetCoinsDto } from './dto/patch-set-coins.dto';
import { FindPublicSetsQueryDto } from './dto/find-public-sets-query.dto';

const MAX_LIMIT = 100;

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<UserSetSummary[]> {
    return this.prisma.userSet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
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
    await this.getOwnedSetOrThrow(userId, id);
    return this.prisma.userSet.update({ where: { id }, data: { name: dto.name } });
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
    return this.prisma.canonicalSet.findMany({ orderBy: { name: 'asc' } });
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

  async findAllPublic(query: FindPublicSetsQueryDto): Promise<PaginatedResponse<UserSetSummary>> {
    const page = query.page;
    const limit = Math.min(query.limit, MAX_LIMIT);

    const [items, total] = await Promise.all([
      this.prisma.userSet.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.userSet.count(),
    ]);

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
