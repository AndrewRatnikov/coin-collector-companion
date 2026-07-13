import { Module } from '@nestjs/common';
import { LinkingModule } from './linking/linking.module';

@Module({
  imports: [LinkingModule],
})
export class CoinsModule {}
