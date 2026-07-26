import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CatalogCoin, PaginatedResponse } from '@coin-collector/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CatalogService } from './catalog.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { CreateCoinDto } from './dto/create-coin.dto';

@ApiTags('catalog')
@ApiBearerAuth()
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

  @Post()
  @ApiOperation({ summary: 'Submit a new coin to the catalog (created as pending review)' })
  @ApiCreatedResponse({ description: 'The newly submitted coin' })
  @ApiConflictResponse({ description: 'A coin with this natural key already exists' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCoinDto): Promise<CatalogCoin> {
    return this.catalogService.create(user.userId, dto);
  }
}
