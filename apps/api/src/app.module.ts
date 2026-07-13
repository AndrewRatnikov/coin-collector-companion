import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SetsModule } from './sets/sets.module';
import { UserSetsModule } from './user-sets/user-sets.module';
import { CoinsModule } from './coins/coins.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SetsModule,
    UserSetsModule,
    CoinsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
