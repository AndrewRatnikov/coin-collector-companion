import { describe, expect, it } from 'vitest';
import { SENTRY_DATA_COLLECTION as API_SETTINGS } from '../../../api/src/sentry-data-collection';
import { SENTRY_DATA_COLLECTION } from './sentry-data-collection';

// Backlog growth 0.5: Sentry events carry no personal data beyond the user id.
describe('SENTRY_DATA_COLLECTION', () => {
  it('turns off every category that can carry personal data', () => {
    expect(SENTRY_DATA_COLLECTION).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      queues: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    });
  });

  it('matches the API settings', () => {
    expect(SENTRY_DATA_COLLECTION).toEqual(API_SETTINGS);
  });
});
