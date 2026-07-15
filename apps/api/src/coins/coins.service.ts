import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Denomination, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<CoinItemView[]> {
    return this.prisma.coinItem.findMany({
      where: { userId },
      select: COIN_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateCoinDto): Promise<CoinItemView> {
    return this.prisma.coinItem.create({
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
  }

  async update(userId: string, id: string, dto: UpdateCoinDto): Promise<CoinItemView> {
    await this.assertOwned(userId, id);

    // Fields omitted from the DTO are undefined here, which Prisma's `update` treats as
    // "leave unchanged" — explicit nulls (e.g. clearing grade) still come through.
    return this.prisma.coinItem.update({
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
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);

    // The CoinItem row is the slot link itself — deleting it frees the slot with no
    // separate unlink step (the SetSlot row is untouched).
    await this.prisma.coinItem.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const coin = await this.prisma.coinItem.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!coin) {
      throw new NotFoundException('Coin not found');
    }
    if (coin.userId !== userId) {
      throw new ForbiddenException('Cannot modify a coin you do not own');
    }
  }
}
