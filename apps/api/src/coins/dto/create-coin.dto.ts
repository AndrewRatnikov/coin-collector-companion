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

  // A bare "YYYY-MM-DD" (what an <input type="date"> sends, and still valid per
  // @IsDateString) isn't accepted by Prisma's DateTime field, which needs a full
  // ISO-8601 datetime — normalized here rather than trusting every caller to pad it.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value,
  )
  @IsDateString()
  acquiredDate?: string | null;
}
