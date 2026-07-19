import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CatalogCoin, PaginatedResponse } from '@coin-collector/shared';
import { Public } from '../auth/decorators/public.decorator';
import { CatalogService } from './catalog.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List/filter the coin catalog' })
  @ApiOkResponse({ description: 'Paginated list of catalog coins' })
  findAll(@Query() query: FindCatalogQueryDto): Promise<PaginatedResponse<CatalogCoin>> {
    return this.catalogService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single catalog coin by id' })
  @ApiOkResponse({ description: 'Catalog coin detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CatalogCoin> {
    return this.catalogService.findOne(id);
  }
}
