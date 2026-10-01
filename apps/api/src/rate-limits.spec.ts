import { AuthController } from './auth/auth.controller';
import { CatalogController } from './catalog/catalog.controller';
import { FeedbackController } from './feedback/feedback.controller';

const limitOf = (fn: unknown): unknown => Reflect.getMetadata('THROTTLER:LIMITdefault', fn as object);
const ttlOf = (fn: unknown): unknown => Reflect.getMetadata('THROTTLER:TTLdefault', fn as object);

describe('route throttle metadata', () => {
  it.each([
    ['CatalogController.create', CatalogController.prototype.create, 20, 3_600_000],
    ['FeedbackController.create', FeedbackController.prototype.create, 5, 3_600_000],
    ['AuthController.register', AuthController.prototype.register, 5, 60_000],
    ['AuthController.login', AuthController.prototype.login, 5, 60_000],
    ['AuthController.forgotPassword', AuthController.prototype.forgotPassword, 3, 3_600_000],
    ['AuthController.resetPassword', AuthController.prototype.resetPassword, 5, 60_000],
  ])('%s has limit %d / ttl %d', (_name, handler, limit, ttl) => {
    expect(limitOf(handler)).toBe(limit);
    expect(ttlOf(handler)).toBe(ttl);
  });
});
