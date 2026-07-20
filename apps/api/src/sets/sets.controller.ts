import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UserSetSummary } from '@coin-collector/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SetsService } from './sets.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';

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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a set (owner only)' })
  @ApiOkResponse({ description: 'Set deleted' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.setsService.remove(user.userId, id);
  }
}
