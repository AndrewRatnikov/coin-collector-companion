import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { CoinStatus } from '@prisma/client';

const COIN_STATUSES: CoinStatus[] = ['approved', 'pending', 'rejected'];

export class FindAdminCoinsQueryDto {
  @ApiPropertyOptional({ enum: COIN_STATUSES, default: 'pending' })
  @IsOptional()
  @IsIn(COIN_STATUSES)
  status: CoinStatus = 'pending';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  // Clamped to 100 in AdminService, same as the catalog list.
  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;
}
