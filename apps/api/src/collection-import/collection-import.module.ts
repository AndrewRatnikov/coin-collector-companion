import { Module } from '@nestjs/common';
import { CollectionImportController } from './collection-import.controller';
import { CollectionImportService } from './collection-import.service';

@Module({
  controllers: [CollectionImportController],
  providers: [CollectionImportService],
})
export class CollectionImportModule {}
