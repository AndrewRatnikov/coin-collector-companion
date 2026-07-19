import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// v2 domain modules (Catalog, Sets, Collection) land per docs/build-roadmap.md — Auth is
// back early as hand-rolled JWT (CLAUDE.md Architecture section), restored from the v1
// module rather than built against Neon Auth's JWKS endpoint. Remaining stub awaiting Day
// 2/5 work; see CLAUDE.md's Project status pivot note.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // SD D2 guard order: ThrottlerGuard -> JwtAuthGuard -> ValidationPipe
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
