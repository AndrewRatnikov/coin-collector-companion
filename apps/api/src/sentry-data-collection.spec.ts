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
});
