import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CoinsService, CoinItemView, CoinMutationResponse } from './coins.service';
import { CreateCoinDto } from './dto/create-coin.dto';
import { UpdateCoinDto } from './dto/update-coin.dto';

@ApiBearerAuth()
@ApiTags('coins')
@Controller('coins')
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's coins" })
  @ApiOkResponse({ description: "The caller's coin collection" })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<CoinItemView[]> {
    return this.coinsService.findAllForUser(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a coin to the collection, with slot-link suggestions' })
  @ApiCreatedResponse({ description: 'Coin created, plus any matching open-slot suggestions' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCoinDto,
  ): Promise<CoinMutationResponse> {
    return this.coinsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a coin; includes slot-link suggestions when denomination/year/mint mark changed',
  })
  @ApiOkResponse({ description: 'Coin updated' })
  @ApiNotFoundResponse({ description: 'Coin not found' })
  @ApiForbiddenResponse({ description: 'Coin belongs to another user' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCoinDto,
  ): Promise<CoinItemView | CoinMutationResponse> {
    return this.coinsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a coin (frees any slot it was linked to)' })
  @ApiNoContentResponse({ description: 'Coin deleted' })
  @ApiNotFoundResponse({ description: 'Coin not found' })
  @ApiForbiddenResponse({ description: 'Coin belongs to another user' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.coinsService.remove(user.userId, id);
  }
}
