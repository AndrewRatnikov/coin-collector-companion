import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OwnershipItem, SetOwnershipResponse } from '@coin-collector/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CollectionService } from './collection.service';
import { SetOwnershipDto } from './dto/set-ownership.dto';
import { FindCollectionQueryDto } from './dto/find-collection-query.dto';

@ApiTags('collection')
@ApiBearerAuth()
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's full collection, optionally filtered" })
  @ApiOkResponse({ description: 'Ownership rows with coin detail' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindCollectionQueryDto,
  ): Promise<OwnershipItem[]> {
    return this.collectionService.findAll(user.userId, query);
  }

  @Patch(':coinId')
  @ApiOperation({ summary: 'Set owned status for a coin (idempotent)' })
  @ApiOkResponse({ description: 'The resulting ownership state' })
  setOwnership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('coinId', ParseUUIDPipe) coinId: string,
    @Body() dto: SetOwnershipDto,
  ): Promise<SetOwnershipResponse> {
    return this.collectionService.setOwnership(user.userId, coinId, dto.owned);
  }
}
