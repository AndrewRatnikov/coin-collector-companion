import { Injectable } from '@nestjs/common';
import { Denomination } from '@prisma/client';
import type { SlotSuggestion } from '@coin-collector/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface SuggestableCoin {
  denomination: Denomination;
  year: number;
  mintMark: string | null;
}

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
}
