import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Denomination } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UserSetSummary {
  userSetId: string;
  set: {
    id: string;
    name: string;
    category: string;
    denomination: Denomination;
  };
  totalSlots: number;
  ownedSlots: number; // client derives % — one rounding rule, defined client-side
  isComplete: boolean; // ownedSlots === totalSlots && totalSlots > 0
  activatedAt: Date;
}

@Injectable()
export class UserSetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<UserSetSummary[]> {
    const userSets = await this.prisma.userSet.findMany({
      where: { userId },
      include: {
        set: { select: { id: true, name: true, category: true, denomination: true } },
      },
      orderBy: { activatedAt: 'desc' },
    });

    if (userSets.length === 0) {
      return [];
    }

    const setIds = userSets.map((userSet) => userSet.setId);

    // Two groupBy queries merged in memory below — no per-set query loop (SD D4).
    const [totalCounts, ownedCounts] = await Promise.all([
      this.prisma.setSlot.groupBy({
        by: ['setId'],
        where: { setId: { in: setIds } },
        _count: { _all: true },
      }),
      this.prisma.setSlot.groupBy({
        by: ['setId'],
        where: { setId: { in: setIds }, coinItems: { some: { userId } } },
        _count: { _all: true },
      }),
    ]);

    const totalBySetId = new Map(totalCounts.map((row) => [row.setId, row._count._all]));
    const ownedBySetId = new Map(ownedCounts.map((row) => [row.setId, row._count._all]));

    return userSets.map((userSet) => {
      const totalSlots = totalBySetId.get(userSet.setId) ?? 0;
      const ownedSlots = ownedBySetId.get(userSet.setId) ?? 0;

      return {
        userSetId: userSet.id,
        set: userSet.set,
        totalSlots,
        ownedSlots,
        isComplete: totalSlots > 0 && ownedSlots === totalSlots,
        activatedAt: userSet.activatedAt,
      };
    });
  }

  async remove(userId: string, userSetId: string): Promise<void> {
    const userSet = await this.prisma.userSet.findUnique({ where: { id: userSetId } });
    if (!userSet) {
      throw new NotFoundException('User set not found');
    }
    if (userSet.userId !== userId) {
      throw new ForbiddenException('Cannot remove a pursuit you do not own');
    }

    // No cascade to CoinItem/SetSlot from UserSet — linked coins keep their slotId (backlog 3.4).
    await this.prisma.userSet.delete({ where: { id: userSetId } });
  }
}
