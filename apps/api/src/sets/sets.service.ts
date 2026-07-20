import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserSet } from '@prisma/client';
import type { UserSetSummary } from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';

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
