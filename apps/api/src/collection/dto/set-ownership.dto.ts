import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { COIN_GRADES, type CoinGrade } from '@coin-collector/shared';

export class SetOwnershipDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  owned!: boolean;

  @ApiPropertyOptional({
    enum: [...COIN_GRADES],
    nullable: true,
    description: 'Omit to keep the current grade; null clears it. Ignored when owned is false.',
  })
  @IsOptional()
  @IsIn(COIN_GRADES)
  grade?: CoinGrade | null;
}
