import { Module } from '@nestjs/common';
import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';
import { LinkingModule } from './linking/linking.module';

@Module({
  imports: [LinkingModule],
  controllers: [CoinsController],
  providers: [CoinsService],
})
export class CoinsModule {}
