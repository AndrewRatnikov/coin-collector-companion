import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { GapViewResponse, UserSetsService, UserSetSummary } from './user-sets.service';

@ApiBearerAuth()
@ApiTags('user-sets')
@Controller('user-sets')
export class UserSetsController {
  constructor(private readonly userSetsService: UserSetsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's pursued sets with owned/total slot counts" })
  @ApiOkResponse({ description: 'Summaries for every set the caller is pursuing' })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<UserSetSummary[]> {
    return this.userSetsService.findAllForUser(user.userId);
  }

  @Get(':id/gap')
  @ApiOperation({ summary: 'Get the gap view (owned vs. missing slots) for a pursued set' })
  @ApiOkResponse({ description: 'Slots ordered by sortOrder, each with its linked coin or null' })
  @ApiNotFoundResponse({ description: 'User set not found' })
  @ApiForbiddenResponse({ description: 'User set belongs to another user' })
  getGapView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<GapViewResponse> {
    return this.userSetsService.getGapView(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop pursuing a set (linked coins keep their slot links)' })
  @ApiNoContentResponse({ description: 'Pursuit removed' })
  @ApiNotFoundResponse({ description: 'User set not found' })
  @ApiForbiddenResponse({ description: 'User set belongs to another user' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.userSetsService.remove(user.userId, id);
  }
}
