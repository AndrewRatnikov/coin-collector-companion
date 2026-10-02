import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// PrismaService comes from the global PrismaModule; RolesGuard is instantiated by Nest from
// @UseGuards on the controller (its Reflector and PrismaService are both injectable here).
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
