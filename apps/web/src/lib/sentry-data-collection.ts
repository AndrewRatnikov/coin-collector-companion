import type { NodeOptions } from '@sentry/nextjs';

// Backlog growth 0.5: no personal data in Sentry events beyond the user id. SDK 11 collects
// user details (IP address, email), request/response bodies, cookies, headers, query strings
// and database query values by default; switch all of them off. Stack traces, route names and
// timings still arrive. Same as apps/api/src/sentry-data-collection.ts; keep in step.
export const SENTRY_DATA_COLLECTION: NonNullable<NodeOptions['dataCollection']> = {
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
};
