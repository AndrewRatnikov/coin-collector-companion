import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CatalogCoin, PaginatedResponse } from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';

const MAX_LIMIT = 100;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindCatalogQueryDto): Promise<PaginatedResponse<CatalogCoin>> {
    const page = query.page;
    const limit = Math.min(query.limit, MAX_LIMIT);

    const where: Prisma.CoinWhereInput = {
      ...(query.country ? { country: query.country } : {}),
      ...(query.denomination ? { denomination: query.denomination } : {}),
      ...(query.name ? { name: { contains: query.name, mode: 'insensitive' as const } } : {}),
      ...(query.yearMin !== undefined || query.yearMax !== undefined
        ? {
            year: {
              ...(query.yearMin !== undefined ? { gte: query.yearMin } : {}),
              ...(query.yearMax !== undefined ? { lte: query.yearMax } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.coin.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ year: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.coin.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async findOne(id: string): Promise<CatalogCoin> {
    const coin = await this.prisma.coin.findUnique({ where: { id } });
    if (!coin) {
      throw new NotFoundException('Coin not found');
    }
    return coin;
  }
}
