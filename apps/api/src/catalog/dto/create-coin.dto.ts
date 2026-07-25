import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { sanitizeIdentityField } from '@coin-collector/shared';

const MAX_YEAR = new Date().getFullYear() + 1; // computed once at module load, not per-request

export class CreateCoinDto {
  @ApiProperty({ example: 'USA' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  country!: string;

  @ApiProperty({ example: 'Cent' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  denomination!: string;

  @ApiProperty({ example: 'Indian Head Cent' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  name!: string;

  @ApiProperty({ example: 1943 })
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(MAX_YEAR)
  year!: number;

  // class-transformer never invokes @Transform for a key that's entirely absent from the
  // request body (confirmed empirically — it only runs when the key is present, even as
  // null) — the `= ''` field default is what makes an omitted mintMark/variety normalize to
  // '' at all, not the Transform. @IsString() then always passes since the value is never
  // undefined by the time validation runs.
  @ApiPropertyOptional({ example: 'D' })
  @Transform(({ value }) => sanitizeIdentityField(value))
  @IsString()
  mintMark: string = '';

  @ApiPropertyOptional({ example: 'Doubled Die' })
  @Transform(({ value }) => sanitizeIdentityField(value))
  @IsString()
  variety: string = '';
}
