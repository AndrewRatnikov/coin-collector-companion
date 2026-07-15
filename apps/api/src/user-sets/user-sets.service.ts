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

export interface GapSlotLinkedCoin {
  coinId: string;
  grade: string | null;
  acquiredDate: Date | null;
}

export interface GapSlot {
  slotId: string;
  year: number;
  mintMark: string | null;
  label: string | null;
  sortOrder: number;
  isKeyDate: boolean;
  linkedCoin: GapSlotLinkedCoin | null; // null = missing — the two-state rule is this field's nullability
}

export interface GapViewResponse {
  userSetId: string;
  set: {
    id: string;
    name: string;
    category: string;
    denomination: Denomination;
  };
  totalSlots: number;
  ownedSlots: number;
  slots: GapSlot[]; // ordered by sortOrder
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

  async getGapView(userId: string, userSetId: string): Promise<GapViewResponse> {
    const userSet = await this.prisma.userSet.findUnique({
      where: { id: userSetId },
      include: {
        set: { select: { id: true, name: true, category: true, denomination: true } },
      },
    });
    if (!userSet) {
      throw new NotFoundException('User set not found');
    }
    if (userSet.userId !== userId) {
      throw new ForbiddenException('Cannot view a pursuit you do not own');
    }

    // One findMany on SetSlot with a filtered include of the caller's own linked coin
    // (SD D4) — the (userId, slotId) unique constraint guarantees 0 or 1 match per slot.
    const slots = await this.prisma.setSlot.findMany({
      where: { setId: userSet.setId },
      include: {
        coinItems: {
          where: { userId },
          select: { id: true, grade: true, acquiredDate: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const gapSlots: GapSlot[] = slots.map((slot) => {
      const linkedCoin = slot.coinItems[0];
      return {
        slotId: slot.id,
        year: slot.year,
        mintMark: slot.mintMark,
        label: slot.label,
        sortOrder: slot.sortOrder,
        isKeyDate: slot.isKeyDate,
        linkedCoin: linkedCoin
          ? { coinId: linkedCoin.id, grade: linkedCoin.grade, acquiredDate: linkedCoin.acquiredDate }
          : null,
      };
    });

    const ownedSlots = gapSlots.reduce((count, slot) => count + (slot.linkedCoin ? 1 : 0), 0);

    return {
      userSetId: userSet.id,
      set: userSet.set,
      totalSlots: gapSlots.length,
      ownedSlots,
      slots: gapSlots,
    };
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
