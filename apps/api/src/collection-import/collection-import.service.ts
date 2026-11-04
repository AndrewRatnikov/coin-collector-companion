import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import {
  COIN_GRADES,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  type ImportConfirmGrade,
  type ImportConfirmResponse,
  type ImportPreviewResponse,
} from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CATALOG_COIN_SELECT } from '../catalog/catalog.service';
import { parseMappingField, suggestMapping } from './column-mapping';
import { CsvImportError, decodeCsvBuffer, parseCsv } from './csv-parser';
import { collectGradeWarnings } from './import-grades';
import { matchRows, summarizeRows } from './import-matcher';

// The subset of a multer memory-storage file this service needs (@types/multer isn't installed).
export interface UploadedCsvFile {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class CollectionImportService {
  constructor(private readonly prisma: PrismaService) {}

  // Read-only: parses and matches the upload in memory. Nothing is written.
  async preview(
    userId: string,
    file: UploadedCsvFile | undefined,
    mappingRaw: string | undefined,
  ): Promise<ImportPreviewResponse> {
    if (!file) {
      throw new BadRequestException('IMPORT_FILE_REQUIRED');
    }
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      throw new PayloadTooLargeException('IMPORT_FILE_TOO_LARGE');
    }

    let parsed: ReturnType<typeof parseCsv>;
    let mapping: ReturnType<typeof suggestMapping>;
    try {
      parsed = parseCsv(decodeCsvBuffer(file.buffer), { maxRows: IMPORT_MAX_ROWS });
      mapping =
        parseMappingField(mappingRaw, parsed.headers.length) ?? suggestMapping(parsed.headers);
    } catch (error) {
      if (error instanceof CsvImportError) {
        throw new BadRequestException(error.code);
      }
      throw error;
    }

    const [catalog, owned] = await Promise.all([
      this.prisma.coin.findMany({ where: { status: 'approved' }, select: CATALOG_COIN_SELECT }),
      this.prisma.ownership.findMany({ where: { userId }, select: { coinId: true } }),
    ]);

    const rows = matchRows({
      rows: parsed.rows,
      mapping,
      catalog,
      ownedCoinIds: new Set(owned.map((o) => o.coinId)),
    });

    return {
      headers: parsed.headers,
      delimiter: parsed.delimiter,
      mapping,
      rows,
      summary: summarizeRows(rows),
      warnings: collectGradeWarnings(parsed.rows, mapping),
    };
  }

  // The import's only write: Ownership rows for approved coins, idempotent via skipDuplicates,
  // then the grades it was sent. Coins without an entry in `grades` keep their current grade.
  async confirm(
    userId: string,
    coinIds: string[],
    grades: ImportConfirmGrade[] = [],
  ): Promise<ImportConfirmResponse> {
    const unique = [...new Set(coinIds)];

    // Every graded coin must be one of the confirmed coins, at most once. Checked before any query.
    const requestedIds = new Set(unique);
    const gradedIds = new Set<string>();
    for (const { coinId } of grades) {
      if (!requestedIds.has(coinId) || gradedIds.has(coinId)) {
        throw new BadRequestException('IMPORT_INVALID_GRADES');
      }
      gradedIds.add(coinId);
    }

    const found = await this.prisma.coin.findMany({
      where: { id: { in: unique }, status: 'approved' },
      select: { id: true },
    });
    if (found.length < unique.length) {
      throw new BadRequestException('IMPORT_UNKNOWN_COIN');
    }

    const data = unique.map((coinId) => ({ userId, coinId }));

    if (grades.length === 0) {
      const { count } = await this.prisma.ownership.createMany({ data, skipDuplicates: true });
      return { requested: unique.length, created: count, alreadyOwned: unique.length - count };
    }

    const count = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ownership.createMany({ data, skipDuplicates: true });
      // One updateMany per grade (at most COIN_GRADES.length), only for the coins sent with it.
      for (const grade of COIN_GRADES) {
        const ids = grades.filter((entry) => entry.grade === grade).map((entry) => entry.coinId);
        if (ids.length > 0) {
          await tx.ownership.updateMany({
            where: { userId, coinId: { in: ids } },
            data: { grade },
          });
        }
      }
      return created.count;
    });

    return { requested: unique.length, created: count, alreadyOwned: unique.length - count };
  }
}
