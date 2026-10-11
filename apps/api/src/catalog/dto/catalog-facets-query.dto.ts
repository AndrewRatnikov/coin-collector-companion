import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CatalogFacetsQueryDto {
  @ApiPropertyOptional({ example: 'Ukraine', description: 'Scopes the denomination list to this country' })
  @IsOptional()
  @IsString()
  country?: string;
}
