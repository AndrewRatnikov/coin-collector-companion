import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Denomination, Grade } from '@coin-collector/shared';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCoinDto {
  @ApiProperty({ enum: Denomination })
  @IsEnum(Denomination)
  denomination!: Denomination;

  @ApiProperty({ example: 1955 })
  @IsInt()
  year!: number;

  // "None"/"P" both mean "no mint mark" (PRD §6.3) — normalized to null here, at the
  // API boundary, rather than trusting the client to send null directly.
  @ApiPropertyOptional({ nullable: true, example: 'D' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim().toUpperCase() === 'P')
      ? null
      : value,
  )
  @IsString()
  mintMark?: string | null;

  @ApiPropertyOptional({ default: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: Grade, nullable: true })
  @IsOptional()
  @IsEnum(Grade)
  grade?: Grade | null;

  // Decimal on the wire as a numeric string (never Float — PRD §6.3); Prisma's Decimal
  // accepts a string input directly, so no numeric parsing happens at this boundary.
  @ApiPropertyOptional({ nullable: true, example: '12.50' })
  @IsOptional()
  @IsNumberString()
  purchasePrice?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  acquiredDate?: string | null;
}
