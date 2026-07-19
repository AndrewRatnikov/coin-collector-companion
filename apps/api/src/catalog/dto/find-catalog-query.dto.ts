import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
