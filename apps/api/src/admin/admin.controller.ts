import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AdminCoin, AdminCoinListItem, PaginatedResponse } from '@coin-collector/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { FindAdminCoinsQueryDto } from './dto/find-admin-coins-query.dto';
import { ReviewCoinDto } from './dto/review-coin.dto';

// Not public: the global JwtAuthGuard answers anonymous callers with 401 first, then the
// class-level RolesGuard re-reads the caller's role from the database and answers 403 for
// anyone who is not an admin.
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('admin')
@UseGuards(RolesGuard)
@ApiUnauthorizedResponse({ description: 'No or invalid access token' })
@ApiForbiddenResponse({ description: 'The caller is not an admin' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('coins')
  @ApiOperation({ summary: 'List catalog coins by status for review (newest first)' })
  @ApiOkResponse({ description: 'Paginated coins with submitter email and a possible-duplicate hint' })
  findCoins(@Query() query: FindAdminCoinsQueryDto): Promise<PaginatedResponse<AdminCoinListItem>> {
    return this.adminService.findCoins(query);
  }

  @Patch('coins/:id')
  @ApiOperation({ summary: 'Approve or reject a pending coin, optionally editing it first' })
  @ApiOkResponse({ description: 'The reviewed coin' })
  @ApiBadRequestResponse({ description: 'Invalid body, or a rejection reason sent with an approval' })
  @ApiNotFoundResponse({ description: 'Coin not found' })
  @ApiConflictResponse({ description: 'Already reviewed, or the edit collides with an existing coin' })
  reviewCoin(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewCoinDto): Promise<AdminCoin> {
    return this.adminService.reviewCoin(id, dto);
  }
}
