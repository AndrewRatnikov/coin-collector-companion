import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OwnershipItem, SetOwnershipResponse } from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FindCollectionQueryDto } from './dto/find-collection-query.dto';

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  async setOwnership(
    userId: string,
    coinId: string,
    owned: boolean,
  ): Promise<SetOwnershipResponse> {
    if (owned) {
      try {
        const row = await this.prisma.ownership.upsert({
          where: { userId_coinId: { userId, coinId } },
          create: { userId, coinId },
          update: {},
        });
        return { coinId, owned: true, ownedAt: row.ownedAt };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw new NotFoundException('Coin not found');
        }
        throw err;
      }
    }

    await this.prisma.ownership.deleteMany({ where: { userId, coinId } });
    return { coinId, owned: false, ownedAt: null };
  }

  async findAll(userId: string, query: FindCollectionQueryDto): Promise<OwnershipItem[]> {
    return this.prisma.ownership.findMany({
      where: {
        userId,
        coin: {
          ...(query.country !== undefined ? { country: query.country } : {}),
          ...(query.year !== undefined ? { year: query.year } : {}),
        },
      },
      include: { coin: true },
      orderBy: { ownedAt: 'desc' },
    });
  }
}
