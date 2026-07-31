import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FindCatalogQueryDto {
  @ApiPropertyOptional({ example: 'USA' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Cent' })
  @IsOptional()
  @IsString()
  denomination?: string;

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
}
