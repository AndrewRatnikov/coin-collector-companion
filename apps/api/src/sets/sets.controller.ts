import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  CanonicalSetDetail,
  CanonicalSetSummary,
  GapViewResponse,
  PaginatedResponse,
  UserSetCoinSummary,
  UserSetDetail,
  UserSetSummary,
} from '@coin-collector/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SetsService } from './sets.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { PatchSetCoinsDto } from './dto/patch-set-coins.dto';
import { FindPublicSetsQueryDto } from './dto/find-public-sets-query.dto';

@ApiTags('sets')
@ApiBearerAuth()
@Controller('sets')
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's own sets" })
  @ApiOkResponse({ description: "The caller's UserSet rows" })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<UserSetSummary[]> {
    return this.setsService.findAllForUser(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a set (blank, or cloned from a canonical/user set)' })
  @ApiOkResponse({ description: 'The newly created set' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSetDto,
  ): Promise<UserSetSummary> {
    return this.setsService.create(user.userId, dto);
  }

  @Public()
  @Get('canonical')
  @ApiOperation({ summary: 'List all canonical sets' })
  @ApiOkResponse({ description: 'All CanonicalSet rows' })
  findAllCanonical(): Promise<CanonicalSetSummary[]> {
    return this.setsService.findAllCanonical();
  }

  @Public()
  @Get('canonical/:id')
  @ApiOperation({ summary: 'Get a canonical set with its ordered coin list' })
  @ApiOkResponse({ description: 'Canonical set detail' })
  findCanonicalById(@Param('id', ParseUUIDPipe) id: string): Promise<CanonicalSetDetail> {
    return this.setsService.findCanonicalById(id);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List every public (user) set across all users, paginated' })
  @ApiOkResponse({ description: 'Paginated list of UserSet rows' })
  findAllPublic(
    @Query() query: FindPublicSetsQueryDto,
  ): Promise<PaginatedResponse<UserSetSummary>> {
    return this.setsService.findAllPublic(query);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Get a public set with its ordered coin list' })
  @ApiOkResponse({ description: 'Public set detail' })
  findPublicById(@Param('id', ParseUUIDPipe) id: string): Promise<UserSetDetail> {
    return this.setsService.findPublicById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a set (owner only)' })
  @ApiOkResponse({ description: 'The updated set' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSetDto,
  ): Promise<UserSetSummary> {
    return this.setsService.update(user.userId, id, dto);
  }

  @Patch(':id/coins')
  @ApiOperation({ summary: 'Add/remove coin IDs from a set (owner only)' })
  @ApiOkResponse({ description: "The set's current coin list" })
  patchCoins(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchSetCoinsDto,
  ): Promise<UserSetCoinSummary[]> {
    return this.setsService.patchCoins(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a set (owner only)' })
  @ApiOkResponse({ description: 'Set deleted' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.setsService.remove(user.userId, id);
  }

  @Get(':id/gaps')
  @ApiOperation({
    summary:
      'Coin list with owned/not-owned status and completion %, computed against the caller — not owner-restricted',
  })
  @ApiOkResponse({ description: 'Gap view for the requested set' })
  getGaps(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GapViewResponse> {
    return this.setsService.getGaps(user.userId, id);
  }
}
