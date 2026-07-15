import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Denomination, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SetListItem {
  id: string;
  name: string;
  category: string;
  denomination: Denomination;
  isTemplate: boolean;
  createdAt: Date;
}

export interface ActivatedUserSet {
  id: string;
  userId: string;
  setId: string;
  activatedAt: Date;
}

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  // isTemplate omitted -> templates (visible to everyone) plus the caller's own custom sets;
  // isTemplate=false is always scoped to ownerId, never someone else's custom set (backlog 3.3)
  findAll(userId: string, isTemplate?: boolean): Promise<SetListItem[]> {
    const where: Prisma.CollectionSetWhereInput =
      isTemplate === true
        ? { isTemplate: true }
        : isTemplate === false
          ? { isTemplate: false, ownerId: userId }
          : { OR: [{ isTemplate: true }, { isTemplate: false, ownerId: userId }] };

    return this.prisma.collectionSet.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        denomination: true,
        isTemplate: true,
        createdAt: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async activate(userId: string, setId: string): Promise<ActivatedUserSet> {
    const set = await this.prisma.collectionSet.findUnique({ where: { id: setId } });
    if (!set) {
      throw new NotFoundException('Set not found');
    }
    if (!set.isTemplate && set.ownerId !== userId) {
      throw new ForbiddenException('Cannot activate a set you do not own');
    }

    // upsert, not findFirst-then-create: activating twice must be a no-op, not a race (backlog 3.3)
    return this.prisma.userSet.upsert({
      where: { userId_setId: { userId, setId } },
      create: { userId, setId },
      update: {},
    });
  }
}
