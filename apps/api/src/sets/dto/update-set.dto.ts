import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { COIN_GRADES, type CoinGrade } from '@coin-collector/shared';

export class UpdateSetDto {
  @ApiPropertyOptional({ example: 'My Renamed Set' })
  // Not @IsOptional(): that would let `name: null` through to a NOT NULL column.
  @ValidateIf((o: UpdateSetDto) => o.name !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    enum: [...COIN_GRADES],
    nullable: true,
    description: 'Owner-only goal; null clears it.',
  })
  @IsOptional()
  @IsIn(COIN_GRADES)
  minGrade?: CoinGrade | null;
}
