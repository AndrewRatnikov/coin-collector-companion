import { Module } from '@nestjs/common';
import { UserSetsController } from './user-sets.controller';
import { UserSetsService } from './user-sets.service';

@Module({
  controllers: [UserSetsController],
  providers: [UserSetsService],
})
export class UserSetsModule {}
