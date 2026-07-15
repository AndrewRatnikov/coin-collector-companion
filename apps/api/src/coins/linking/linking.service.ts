import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Denomination, Prisma } from '@prisma/client';
import type { SlotSuggestion } from '@coin-collector/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { CoinItemView } from '../coins.service';

export interface SuggestableCoin {
  denomination: Denomination;
  year: number;
  mintMark: string | null;
}

// Mirrors packages/shared's CoinLinkResponse, Prisma-native (see CoinItemView vs. CoinDto
// note in CLAUDE.md 4.2/4.3) — replacedCoinId lets the UI toast "replaced — old coin kept".
export interface CoinLinkResult {
  coin: CoinItemView;
  replacedCoinId: string | null;
}

const COIN_SELECT = {
  id: true,
  denomination: true,
  year: true,
  mintMark: true,
  country: true,
  grade: true,
  purchasePrice: true,
  notes: true,
  acquiredDate: true,
  imageUrls: true,
  slotId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CoinItemSelect;

@Injectable()
export class LinkingService {
  constructor(private readonly prisma: PrismaService) {}

  // Sole implementor of the match rule (SD D3): set.denomination + slot.year + slot.mintMark,
  // scoped to sets the user has actually activated (join through UserSet — active sets only).
  // `excludeCoinId` keeps a coin being edited from showing up as its own "currently linked" slot.
  async suggest(
    userId: string,
    coin: SuggestableCoin,
    excludeCoinId?: string,
  ): Promise<SlotSuggestion[]> {
    const slots = await this.prisma.setSlot.findMany({
      where: {
        year: coin.year,
        mintMark: coin.mintMark ?? null, // null-safe equality — null matches null (PRD §6.3)
        set: {
          denomination: coin.denomination,
          userSets: { some: { userId } },
        },
      },
      include: {
        set: { select: { name: true } },
        coinItems: {
          where: excludeCoinId ? { userId, id: { not: excludeCoinId } } : { userId },
          select: { id: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return slots.map((slot) => ({
      slotId: slot.id,
      setName: slot.set.name,
      slotLabel: slot.label ?? `${slot.year}${slot.mintMark ? `-${slot.mintMark}` : ''}`,
      isKeyDate: slot.isKeyDate,
      currentlyLinkedCoinId: slot.coinItems[0]?.id ?? null,
    }));
  }

  // Sole writer of CoinItem.slotId (SD D3). One transaction: assert ownership + that the
  // slot's set is one the caller has activated, displace whoever currently occupies the
  // slot (0 or 1 rows — the (userId, slotId) unique constraint is the backstop, never the
  // mechanism), then link. Displacing before linking means the constraint never actually fires.
  async link(userId: string, coinId: string, slotId: string): Promise<CoinLinkResult> {
    return this.prisma.$transaction(async (tx) => {
      const coin = await tx.coinItem.findUnique({ where: { id: coinId } });
      if (!coin) {
        throw new NotFoundException('Coin not found');
      }
      if (coin.userId !== userId) {
        throw new ForbiddenException('Cannot link a coin you do not own');
      }

      const slot = await tx.setSlot.findUnique({
        where: { id: slotId },
        select: {
          id: true,
          set: { select: { userSets: { where: { userId }, select: { id: true } } } },
        },
      });
      if (!slot) {
        throw new NotFoundException('Slot not found');
      }
      if (slot.set.userSets.length === 0) {
        throw new ForbiddenException('Cannot link into a set you have not activated');
      }

      const occupant = await tx.coinItem.findFirst({
        where: { userId, slotId, id: { not: coinId } },
        select: { id: true },
      });
      await tx.coinItem.updateMany({
        where: { userId, slotId, id: { not: coinId } },
        data: { slotId: null },
      });

      const updated = await tx.coinItem.update({
        where: { id: coinId },
        data: { slotId },
        select: COIN_SELECT,
      });

      return { coin: updated, replacedCoinId: occupant?.id ?? null };
    });
  }

  async unlink(userId: string, coinId: string): Promise<CoinItemView> {
    const coin = await this.prisma.coinItem.findUnique({
      where: { id: coinId },
      select: { userId: true },
    });
    if (!coin) {
      throw new NotFoundException('Coin not found');
    }
    if (coin.userId !== userId) {
      throw new ForbiddenException('Cannot unlink a coin you do not own');
    }

    return this.prisma.coinItem.update({
      where: { id: coinId },
      data: { slotId: null },
      select: COIN_SELECT,
    });
  }
}
