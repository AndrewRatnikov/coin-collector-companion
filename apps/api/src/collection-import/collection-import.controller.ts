import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IMPORT_MAX_FILE_BYTES,
  type ImportConfirmResponse,
  type ImportPreviewResponse,
} from '@coin-collector/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CollectionImportService, type UploadedCsvFile } from './collection-import.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { PreviewImportDto } from './dto/preview-import.dto';

// Both routes sit behind the global JwtAuthGuard (no @Public()).
@ApiTags('collection')
@ApiBearerAuth()
@Controller('collection/import')
export class CollectionImportController {
  constructor(private readonly collectionImportService: CollectionImportService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Parse and match an uploaded CSV against the catalog; writes nothing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        mapping: { type: 'string', description: 'Optional JSON column mapping' },
      },
    },
  })
  @ApiOkResponse({ description: 'Per-row preview and summary' })
  // Memory storage only (multer's default): the upload never touches disk.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMPORT_MAX_FILE_BYTES, files: 1, fields: 2, fieldSize: 4096 },
    }),
  )
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() body: PreviewImportDto,
  ): Promise<ImportPreviewResponse> {
    return this.collectionImportService.preview(user.userId, file, body.mapping);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark the confirmed coins as owned (idempotent)' })
  @ApiOkResponse({ description: 'How many ownership rows were created' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmImportDto,
  ): Promise<ImportConfirmResponse> {
    return this.collectionImportService.confirm(user.userId, dto.coinIds);
  }
}
