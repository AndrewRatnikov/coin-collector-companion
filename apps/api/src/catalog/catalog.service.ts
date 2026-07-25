import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CatalogCoin, PaginatedResponse } from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { CreateCoinDto } from './dto/create-coin.dto';

const MAX_LIMIT = 100;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindCatalogQueryDto): Promise<PaginatedResponse<CatalogCoin>> {
    const page = query.page;
    const limit = Math.min(query.limit, MAX_LIMIT);

    const where: Prisma.CoinWhereInput = {
      status: 'approved',
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

  async create(userId: string, dto: CreateCoinDto): Promise<CatalogCoin> {
    const dedupeWhere: Prisma.CoinWhereInput = {
      country: { equals: dto.country, mode: 'insensitive' as const },
      denomination: { equals: dto.denomination, mode: 'insensitive' as const },
      year: dto.year,
      mintMark: dto.mintMark ?? '',
      variety: dto.variety ?? '',
    };

    const existing = await this.prisma.coin.findFirst({ where: dedupeWhere });
    if (existing) {
      throw new ConflictException('A coin with this natural key already exists');
    }

    try {
      return await this.prisma.coin.create({
        data: {
          country: dto.country,
          denomination: dto.denomination,
          year: dto.year,
          mintMark: dto.mintMark ?? '',
          variety: dto.variety ?? '',
          name: dto.name,
          status: 'pending',
          submittedByUserId: userId,
          submittedAt: new Date(),
        },
        select: {
          id: true,
          country: true,
          denomination: true,
          year: true,
          mintMark: true,
          variety: true,
          name: true,
          imageUrl: true,
          imageSource: true,
          imageLicense: true,
          status: true,
          submittedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A coin with this natural key already exists');
      }
      throw err;
    }
  }
}
