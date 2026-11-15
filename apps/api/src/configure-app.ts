import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export interface TrustProxyHopsResult {
  hops: number;
  invalid: boolean;
}

const logger = new Logger('ConfigureApp');

/**
 * Parses TRUST_PROXY_HOPS: the number of reverse-proxy hops whose X-Forwarded-For entries are
 * trusted when Express computes req.ip. Unset/empty means 0 (trust nothing). Anything that is
 * not a non-negative integer is invalid and falls back to 0. Never returns `true`, which would
 * let clients spoof X-Forwarded-For to dodge rate limits.
 */
export function parseTrustProxyHops(raw: string | undefined): TrustProxyHopsResult {
  if (raw === undefined) {
    return { hops: 0, invalid: false };
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { hops: 0, invalid: false };
  }
  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    if (Number.isSafeInteger(hops)) {
      return { hops, invalid: false };
    }
  }
  return { hops: 0, invalid: true };
}

/**
 * Shared app setup used by main.ts and the e2e tests: trust proxy, security headers (helmet),
 * cookie parsing, credentialed CORS, the api/v1 prefix and the validation pipe.
 */
export function configureApp(app: NestExpressApplication): void {
  const raw = process.env.TRUST_PROXY_HOPS;
  const { hops, invalid } = parseTrustProxyHops(raw);
  if (invalid) {
    logger.warn(`Invalid TRUST_PROXY_HOPS value "${raw}"; expected a non-negative integer. Falling back to 0.`);
  }
  app.set('trust proxy', hops);

  // Security headers with helmet's defaults on purpose (see the security-headers ADR in docs/adr/):
  // Swagger UI at /api/docs (mounted by main.ts after this call) works under the default CSP, and
  // CORP/COOP same-origin don't affect the web app's CORS-mode fetch calls.
  app.use(helmet());

  app.use(cookieParser());

  app.enableCors({
    origin: [process.env.CORS_ORIGIN, 'http://localhost:3000'].filter((o): o is string => Boolean(o)),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
