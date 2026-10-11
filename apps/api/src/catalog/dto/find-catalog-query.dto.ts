import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CATALOG_SORTS, DEFAULT_CATALOG_SORT, type CatalogSort } from '@coin-collector/shared';

export class FindCatalogQueryDto {
  @ApiPropertyOptional({ example: 'USA' })
  @IsOptional()
  @IsString()
  country?: string;

  // Repeatable (`?denomination=a&denomination=b`), OR-ed case-insensitively. Whenever the key is
  // present the value is normalised to an array; the union type keeps callers that build the DTO
  // directly with a single string working (CatalogService accepts both forms).
  @ApiPropertyOptional({ type: [String], example: ['5 Kopiyok', '10 Hryvnias'] })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsString({ each: true })
  denomination?: string | string[];

  @ApiPropertyOptional({ example: 'Lincoln Wheat Cent' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1909 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearMin?: number;

  @ApiPropertyOptional({ example: 1958 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearMax?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  // Only honored when the caller is authenticated (see CatalogService.findAll) — an
  // anonymous caller sending this is silently ignored, not rejected. Query params always
  // arrive as strings even under the global transform: true pipe, hence the explicit
  // @Transform rather than relying on @IsBoolean() alone.
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  submittedByMe?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Only key-date coins' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  keyDateOnly?: boolean;

  // Like submittedByMe: honored only for an authenticated caller, silently ignored otherwise.
  @ApiPropertyOptional({ example: true, description: "Hide coins the caller owns (ignored when anonymous)" })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  hideOwned?: boolean;

  // A class-field initializer, not @Transform: @Transform doesn't run for an absent key.
  @ApiPropertyOptional({ enum: [...CATALOG_SORTS], default: DEFAULT_CATALOG_SORT })
  @IsOptional()
  @IsIn(CATALOG_SORTS)
  sort: CatalogSort = DEFAULT_CATALOG_SORT;
}
