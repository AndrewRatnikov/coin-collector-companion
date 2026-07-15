import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Denomination, Prisma } from '@prisma/client';
import type { SlotSuggestion } from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';
import { LinkingService } from './linking/linking.service';

export interface CoinItemView {
  id: string;
  denomination: Denomination;
  year: number;
  mintMark: string | null;
  country: string;
  grade: string | null;
  purchasePrice: Prisma.Decimal | null;
  notes: string | null;
  acquiredDate: Date | null;
  imageUrls: string[];
  slotId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Prisma-native mirror of packages/shared's CoinMutationResponse — kept local rather than
// importing the shared contract directly, same reasoning as CoinItemView vs. CoinDto (see
// CLAUDE.md 4.2 notes): Prisma's Denomination union isn't assignable back into the shared enum.
export interface CoinMutationResponse {
  coin: CoinItemView;
  suggestions: SlotSuggestion[];
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
export class CoinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly linkingService: LinkingService,
  ) {}

  findAllForUser(userId: string): Promise<CoinItemView[]> {
    return this.prisma.coinItem.findMany({
      where: { userId },
      select: COIN_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateCoinDto): Promise<CoinMutationResponse> {
    const coin = await this.prisma.coinItem.create({
      data: {
        userId,
        denomination: dto.denomination,
        year: dto.year,
        mintMark: dto.mintMark ?? null,
        country: dto.country,
        grade: dto.grade ?? null,
        purchasePrice: dto.purchasePrice ?? null,
        notes: dto.notes ?? null,
        acquiredDate: dto.acquiredDate ?? null,
      },
      select: COIN_SELECT,
    });

    const suggestions = await this.linkingService.suggest(userId, {
      denomination: coin.denomination,
      year: coin.year,
      mintMark: coin.mintMark,
    });

    return { coin, suggestions };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCoinDto,
  ): Promise<CoinItemView | CoinMutationResponse> {
    const existing = await this.assertOwned(userId, id);

    // Fields omitted from the DTO are undefined here, which Prisma's `update` treats as
    // "leave unchanged" — explicit nulls (e.g. clearing grade) still come through.
    const coin = await this.prisma.coinItem.update({
      where: { id },
      data: {
        denomination: dto.denomination,
        year: dto.year,
        mintMark: dto.mintMark,
        country: dto.country,
        grade: dto.grade,
        purchasePrice: dto.purchasePrice,
        notes: dto.notes,
        acquiredDate: dto.acquiredDate,
      },
      select: COIN_SELECT,
    });

    // Suggestions are only recomputed when the match key actually moved (SD §4) — a plain
    // field edit (price, notes, grade, ...) returns the bare coin, no suggestion panel.
    const matchKeyChanged =
      (dto.denomination !== undefined && dto.denomination !== existing.denomination) ||
      (dto.year !== undefined && dto.year !== existing.year) ||
      (dto.mintMark !== undefined && dto.mintMark !== existing.mintMark);

    if (!matchKeyChanged) {
      return coin;
    }

    const suggestions = await this.linkingService.suggest(
      userId,
      { denomination: coin.denomination, year: coin.year, mintMark: coin.mintMark },
      id,
    );

    return { coin, suggestions };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);

    // The CoinItem row is the slot link itself — deleting it frees the slot with no
    // separate unlink step (the SetSlot row is untouched).
    await this.prisma.coinItem.delete({ where: { id } });
  }

  private async assertOwned(
    userId: string,
    id: string,
  ): Promise<{ denomination: Denomination; year: number; mintMark: string | null }> {
    const coin = await this.prisma.coinItem.findUnique({
      where: { id },
      select: { userId: true, denomination: true, year: true, mintMark: true },
    });
    if (!coin) {
      throw new NotFoundException('Coin not found');
    }
    if (coin.userId !== userId) {
      throw new ForbiddenException('Cannot modify a coin you do not own');
    }
    return coin;
  }
}
