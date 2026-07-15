import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { FindSetsQueryDto } from './dto/find-sets-query.dto';
import { ActivatedUserSet, SetListItem, SetsService } from './sets.service';

@ApiBearerAuth()
@ApiTags('sets')
@Controller('sets')
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  @Get()
  @ApiOperation({ summary: "List set templates and the caller's own custom sets" })
  @ApiOkResponse({ description: 'Sets matching the isTemplate filter' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindSetsQueryDto,
  ): Promise<SetListItem[]> {
    return this.setsService.findAll(user.userId, query.isTemplate);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start pursuing a set (idempotent)' })
  @ApiOkResponse({ description: 'The UserSet row for the pursued set' })
  @ApiNotFoundResponse({ description: 'Set not found' })
  @ApiForbiddenResponse({ description: 'Set is a custom set owned by another user' })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ActivatedUserSet> {
    return this.setsService.activate(user.userId, id);
  }
}
