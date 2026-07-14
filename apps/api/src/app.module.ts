import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
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
  providers: [
    // SD D2 guard order: ThrottlerGuard -> JwtAuthGuard (ThrottlerGuard added in 2.4)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
