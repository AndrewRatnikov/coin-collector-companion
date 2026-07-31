# Technical Plan: Auth foundation for apps/web — token storage, login/signup, Bearer attachment, route protection

**Run:** run_20260721_094026
**Date:** 2026-07-21

## Summary

Adds a small `lib/auth-token.ts` + `lib/auth-api.ts` pair, wires `apiFetch` to attach `Authorization: Bearer` and auto-clear a session on a real 401, and adds `/login`, `/signup`, and a placeholder `/dashboard` page behind a new reusable `RequireAuth` client-side guard. `apps/web` has no test framework today, so this plan also introduces a minimal Vitest + Testing Library setup, scoped to unit/component tests for exactly the files this task touches.

## Approach

1. **Token storage (`lib/auth-token.ts`, new).** Three tiny functions over `window.localStorage`, all SSR-guarded (`typeof window === 'undefined'` short-circuits). No React involved — plain functions, easy to unit test directly.

2. **Auth API wrappers (`lib/auth-api.ts`, new).** `login`/`register` each call the existing `apiFetch<AuthResponse>('/auth/login' | '/auth/register', { method: 'POST', body: JSON.stringify(credentials) })` and, only on success, call `setStoredToken(response.accessToken)`. `apiFetch` already throws `ApiError` on non-2xx, so wrong-credentials handling is just "let it throw" — the calling page catches it.

3. **`apiFetch` Bearer attachment + 401 handling (`lib/api-client.ts`, modify).** Two changes inside the existing function, no signature change:
   - Before the request is sent: if `getStoredToken()` returns a token, set `Authorization: Bearer <token>` on the request headers.
   - Inside the existing `if (!response.ok)` branch, **only when a token was actually attached to this request** (i.e. `token` was non-null) and `response.status === 401`: call `clearStoredToken()` and, guarded by `typeof window !== 'undefined'`, set `window.location.href = '/login'` — then fall through to the existing `throw new ApiError(...)` unchanged.
   - **Why gate on "a token was attached":** `/auth/login` and `/auth/register` also return 401/409 on bad credentials, with no token ever attached (anonymous request). Auto-clearing/redirecting on *that* 401 would yank the user off the login page mid-submit instead of letting the page show the failure inline as PRD criterion 4 requires. Gating the clear+redirect behavior on "we sent a Bearer token and the server rejected it" makes it mean what the original v1-era comment intended — an invalidated *session*, not a plain unauthenticated request — and cleanly resolves the conflict between criteria 3 and 4 without adding a URL-based special case.
   - Remove the now-resolved `// Auth header attachment ... was removed here pending the v2 auth decision` comment.

4. **`RequireAuth` guard (`components/auth/require-auth.tsx`, new).** Client component. On mount (`useEffect`, since redirecting is a side effect): if `getStoredToken()` is present, renders `children`; otherwise calls `router.replace('/login')` and renders a `Skeleton`-based pending state (never renders `children` in that branch, so protected content never flashes to an unauthenticated visitor). This is the reusable mechanism `/collection`, `/sets/new`, and `/sets/[id]` will each wrap their content in once those pages exist (Day 3/4) — that wiring is out of scope here.

5. **`/login` and `/signup` pages (new).** Client components with local `email`/`password` state, submit handler calls `login`/`register` from step 2, maps a thrown `ApiError`'s `details` through the existing `fieldErrorsFrom` (`lib/form-errors.ts`) against `['email', 'password']` for field-level errors, with any unmatched detail shown as a page-level error. On success, `router.push('/dashboard')`.

6. **Placeholder `/dashboard` page (new).** Wraps its content in `RequireAuth`; exists solely so (5)'s post-login/signup redirect target is real, matching the backlog's own note that a placeholder here is fine ("built for real on Day 3").

7. **Test infrastructure (new).** `apps/web` has no test framework configured (`repo-digest.md`'s Test command is `UNKNOWN`, no `*.test.*`/`*.spec.*` files exist under `apps/web`). Introduces Vitest + `@testing-library/react`/`jest-dom`/`user-event` + `jsdom`, scoped narrowly: a `vitest.config.ts` (jsdom environment, `@/` alias matching `tsconfig.json`), a `vitest.setup.ts` (jest-dom matchers), and a `test` script in `apps/web/package.json`. `apps/api` already uses Jest, but Jest's ESM/Next-App-Router support is materially worse than Vitest's for this stack (Next 16, React 19, `next/navigation`), so this plan does not force Jest-for-consistency onto `apps/web` — it's a genuinely different runtime concern than `apps/api`'s NestJS unit tests. Test files are colocated `*.test.ts`/`*.test.tsx` next to the source they cover (mirrors `apps/api`'s colocation habit, just with Vitest's own default suffix instead of `.spec.ts`).

8. **pnpm build allowlist (`pnpm-workspace.yaml`, modify).** Per `memory.md`'s Known gotchas: this repo's pnpm setup blocks a transitive dependency's native postinstall/build script unless it's explicitly allowlisted in `pnpm-workspace.yaml`'s `allowBuilds` map (already used here for `bcrypt`/`sharp`/Prisma). Vitest pulls in `esbuild` (native postinstall binary) as a transitive dependency of Vite; without allowlisting it, `pnpm install` exits non-zero (`ERR_PNPM_IGNORED_BUILDS`) the moment this task's new devDependencies are added — including inside the pipeline's own disposable sandbox worktree at Stage 6. Add `esbuild: true` to `allowBuilds` up front rather than discovering this via a failed sandbox run.

### Edge cases this implementation must handle

- `getStoredToken()` called during SSR (no `window`) must not throw — returns `null`.
- `apiFetch` calls with no stored token must omit the `Authorization` header entirely (not send `Bearer null`/`Bearer undefined`).
- A 401 from `/auth/login`/`/auth/register` (no token was attached) must NOT clear/redirect — must propagate as a normal `ApiError` for the form to catch.
- A 401 from any *other* endpoint (a token was attached and rejected) must clear the token and redirect, and must still throw `ApiError` afterward (callers already mid-flight should not silently swallow the error).
- `RequireAuth` must never render `children` before the token check resolves — no flash of protected content.
- Login/signup form submission errors that don't map to a known field (e.g. a generic network/timeout error) must still surface, as a page-level error, not silently disappear.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/auth-token.ts` | CREATE | SSR-safe localStorage token get/set/clear |
| `apps/web/src/lib/auth-api.ts` | CREATE | `login`/`register` wrappers over `apiFetch`, storing the token on success |
| `apps/web/src/lib/api-client.ts` | MODIFY | Attach `Authorization: Bearer`; clear+redirect on a session-invalidating 401 |
| `apps/web/src/components/auth/require-auth.tsx` | CREATE | Reusable client-side route guard |
| `apps/web/src/app/login/page.tsx` | CREATE | Login form page |
| `apps/web/src/app/signup/page.tsx` | CREATE | Signup form page |
| `apps/web/src/app/dashboard/page.tsx` | CREATE | Placeholder authenticated page, wrapped in `RequireAuth` |
| `apps/web/package.json` | MODIFY | Add `test` script + Vitest/Testing-Library devDependencies |
| `apps/web/vitest.config.ts` | CREATE | Vitest config: jsdom environment, `@/` alias, setup file |
| `apps/web/vitest.setup.ts` | CREATE | Registers `@testing-library/jest-dom` matchers |
| `pnpm-workspace.yaml` | MODIFY | Add `esbuild: true` to `allowBuilds` (Vitest/Vite transitive native postinstall) |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Module: `auth-token`
- **File:** `apps/web/src/lib/auth-token.ts`
- **Exports:**
  ```typescript
  export const AUTH_TOKEN_STORAGE_KEY = 'ccc-auth-token';
  export function getStoredToken(): string | null;
  export function setStoredToken(token: string): void;
  export function clearStoredToken(): void;
  ```
- **Behavior contract:**
  - `getStoredToken()`: returns `null` if `typeof window === 'undefined'` or the key is absent; otherwise the raw stored string via `window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)`.
  - `setStoredToken(token)`: no-op if `typeof window === 'undefined'`; otherwise `window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)`.
  - `clearStoredToken()`: no-op if `typeof window === 'undefined'`; otherwise `window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)`.
- **Dependencies:** none (no imports beyond the DOM `localStorage` global).

### Module: `auth-api`
- **File:** `apps/web/src/lib/auth-api.ts`
- **Exports:**
  ```typescript
  export interface LoginCredentials {
    email: string;
    password: string;
  }
  export interface RegisterCredentials {
    email: string;
    password: string;
  }
  export interface AuthResponse {
    accessToken: string;
  }
  export async function login(credentials: LoginCredentials): Promise<AuthResponse>;
  export async function register(credentials: RegisterCredentials): Promise<AuthResponse>;
  ```
- **Behavior contract:**
  - `login`: `apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) })`; on resolution, call `setStoredToken(result.accessToken)`, then return `result`. A rejection (thrown `ApiError`) propagates unchanged — no token is stored.
  - `register`: identical shape against `/auth/register`.
- **Dependencies:** `apiFetch` from `@/lib/api-client`, `setStoredToken` from `@/lib/auth-token`.

### Module: `api-client` (existing file, modified)
- **File:** `apps/web/src/lib/api-client.ts`
- **Exports:** unchanged signature — `ApiError` class, `apiFetch<T>(path: string, init?: RequestInit): Promise<T>`.
- **New behavior contract:**
  - Reads `getStoredToken()` once per call, before sending the request. If non-null, sets `headers.set('Authorization', \`Bearer ${token}\`)`. If null, the header is not set at all.
  - Inside the existing `if (!response.ok)` block, before constructing/throwing `ApiError`: `if (token && response.status === 401) { clearStoredToken(); if (typeof window !== 'undefined') { window.location.href = '/login'; } }`. The `token` here is the same local variable read at the top of the function — this is what makes the check "was a token attached to this specific request", not "does a token currently exist in storage".
  - The `ApiError` is still thrown afterward in both the 401-with-token and any-other-error case — this change never swallows an error, only adds a side effect before the existing throw.
  - Removes the `// Auth header attachment ... was removed here pending the v2 auth decision` comment block.
- **Dependencies (new imports):** `getStoredToken`, `clearStoredToken` from `@/lib/auth-token`.

### Component: `RequireAuth`
- **File:** `apps/web/src/components/auth/require-auth.tsx`
- **Export:** `export function RequireAuth({ children }: { children: React.ReactNode }): JSX.Element`
- **Behavior contract:**
  - `'use client'` component. On mount (inside `useEffect`), calls `getStoredToken()`:
    - Token present → internal state becomes `'authorized'`, renders `{children}` directly (no wrapper element around them).
    - Token absent → internal state becomes `'redirecting'`, calls `router.replace('/login')` (from `next/navigation`'s `useRouter`).
  - Before the effect resolves (`'checking'`) and while `'redirecting'`, renders:
    ```tsx
    <div data-testid="require-auth-pending">
      <Skeleton />
    </div>
    ```
  - Never renders `children` in the same render pass as calling `router.replace`.
- **Test selectors:**
  - `data-testid="require-auth-pending"` — present exactly when children are NOT rendered (both `'checking'` and `'redirecting'` states)
- **Dependencies:** `getStoredToken` from `@/lib/auth-token`, `useRouter` from `next/navigation`, `Skeleton` from `@/components/ui/skeleton`.

### Page: Login
- **File:** `apps/web/src/app/login/page.tsx`
- **Export:** `export default function LoginPage(): JSX.Element` — `'use client'`.
- **Structure/selectors:**
  - Root: `data-testid="login-page"`
  - `<form data-testid="login-form">` with `onSubmit` (preventDefault, calls `login` from `@/lib/auth-api`)
  - Email field: `FormField` with `id="email"`, `type="email"`, `autoComplete="email"`
  - Password field: `FormField` with `id="password"`, `type="password"`, `autoComplete="current-password"`
  - Submit button: `<button type="submit" data-testid="login-submit">`
  - Page-level error (any `ApiError` detail not matched to `email`/`password` by `fieldErrorsFrom`): `<p data-testid="login-form-error">{message}</p>`, rendered only when non-empty
- **Behavior contract:** on submit, calls `login({ email, password })`. On success: `router.push('/dashboard')`. On a thrown `ApiError`:
  - **Only when `error.status === 400`** (Nest's `ValidationPipe` — the only response shape in this API that actually carries an array of per-field, class-validator-prefixed messages): run `fieldErrorsFrom(error.details, ['email', 'password'])`; matched entries become each `FormField`'s `error` prop; any details with no matching field are joined and shown via `login-form-error`.
  - **For every other status** (401 wrong-credentials, 409 conflict, etc.): never run `fieldErrorsFrom` — show `error.details.join(', ')` directly via `login-form-error`. This avoids a real failure mode: a non-validation message that happens to start with a field name as an ordinary English word (e.g. a 409 "Email already registered") would otherwise false-positive-match the `email` field through `fieldErrorsFrom`'s case-insensitive prefix check, which is calibrated for class-validator's literal `"email must be ..."` message shape, not prose.
- **Dependencies:** `FormField` (`@/components/auth/form-field`), `login` (`@/lib/auth-api`), `fieldErrorsFrom` (`@/lib/form-errors`), `ApiError` (`@/lib/api-client`), `useRouter` (`next/navigation`).

### Page: Signup
- **File:** `apps/web/src/app/signup/page.tsx`
- **Export:** `export default function SignupPage(): JSX.Element` — `'use client'`.
- **Structure/selectors:** identical pattern to Login, with the `signup-` prefix: `data-testid="signup-page"`, `data-testid="signup-form"`, same `FormField` ids (`email`/`password`), `data-testid="signup-submit"`, `data-testid="signup-form-error"`.
- **Behavior contract:** calls `register({ email, password })` from `@/lib/auth-api` instead of `login`; same success redirect to `/dashboard` and the same status-gated `fieldErrorsFrom` error mapping described above for Login (`error.status === 400` → field-level, everything else → page-level via `error.details.join(', ')`).
- **Dependencies:** same as Login page, but `register` instead of `login`.

### Page: Dashboard (placeholder)
- **File:** `apps/web/src/app/dashboard/page.tsx`
- **Export:** `export default function DashboardPage(): JSX.Element`
- **Structure/selectors:** `<RequireAuth><main data-testid="dashboard-page">...placeholder content...</main></RequireAuth>`
- **Dependencies:** `RequireAuth` from `@/components/auth/require-auth`.

### Test infrastructure
- **`apps/web/vitest.config.ts`** — `defineConfig` from `vitest/config`, `plugins: [react()]` (`@vitejs/plugin-react`), `test.environment: 'jsdom'`, `test.setupFiles: ['./vitest.setup.ts']`, `test.globals: true`, `test.env: { NEXT_PUBLIC_API_URL: 'http://localhost:4000/api' }` (`api-client.ts` reads `process.env.NEXT_PUBLIC_API_URL` at module load — any test importing `auth-api.ts`/`api-client.ts`, directly or transitively, needs this set before import or `apiFetch` throws `NEXT_PUBLIC_API_URL is not set` unconditionally), `resolve.alias['@']` → `./src` (mirrors `tsconfig.json`'s `paths`).
- **`apps/web/vitest.setup.ts`** — single line: `import '@testing-library/jest-dom/vitest';`
- **`apps/web/package.json`** — add `"test": "vitest run"` to `scripts`; add to `devDependencies`: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` (Coder resolves exact caret versions compatible with the already-pinned React 19/Next 16/TS 5 stack via `pnpm add -D` rather than hand-typing guesses).
- **Test file convention:** colocated `*.test.ts` (for `auth-token.ts`, `auth-api.ts`, the `api-client.ts` Bearer/401 behavior) and `*.test.tsx` (for `RequireAuth`, `LoginPage`, `SignupPage`) next to the source file each covers.
- **Mocking conventions the Tester must follow** (repo-specific, from `memory.md`'s Known gotchas):
  - Mock `fetch` via `vi.stubGlobal('fetch', vi.fn())` — but `check-contract.sh`'s banned-pattern check only recognizes the literal substring `vi.mock(`/`jest.mock(` as proof a `fetch()` call is mocked, so it will false-positive on `vi.stubGlobal` alone. Every test file that mocks `fetch` this way must include a comment containing the literal substring `vi.mock(` (e.g. `// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts`) to avoid a false `BANNED_PATTERN` violation at the contract gate.
  - Any test touching `RequireAuth`, `LoginPage`, or `SignupPage` must mock `next/navigation`'s `useRouter` (e.g. `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))`) — Next's real router throws outside an app-router runtime context.
  - Tests touching `localStorage` (directly or via `auth-token.ts`) must call `localStorage.clear()` in a `beforeEach` to avoid cross-test pollution — jsdom's `localStorage` persists across tests in the same file/run otherwise.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `auth-token.ts` SSR-safe get/set/clear | `Module: auth-token` |
| 2. `auth-api.ts` login/register storing token on success | `Module: auth-api` |
| 3. `apiFetch` Bearer attachment + 401 clear/redirect (without breaking login/signup's own 401 handling) | `Module: api-client` (token-gated 401 check) |
| 4. `/login`, `/signup` pages with FormField + form-errors mapping, redirect to `/dashboard` on success | `Page: Login`, `Page: Signup` |
| 5. Reusable guard applied to a placeholder `/dashboard`, documented for Day 3/4 routes | `Component: RequireAuth`, `Page: Dashboard (placeholder)` |
| 6. `/catalog`, `/sets/canonical`, `/sets/public`, etc. remain untouched/ungated | No files in this plan touch those routes — verifiable by the Files changed table containing none of them |

## Risks and open questions

- **New dependencies (Vitest + Testing Library stack):** justified above (PRD's own open question asks for this; no test framework currently exists in `apps/web`). Coder should let `pnpm add -D` resolve real version numbers rather than trusting hand-picked ones in this plan.
- **`window.location.href` vs. Next.js router for the 401 redirect:** `api-client.ts` is a plain module, not a component, so it can't call `useRouter()`. A hard navigation (`window.location.href`) is the correct mechanism here (also guarantees any in-flight React Query cache tied to the invalidated session is discarded on reload) — the Coder should not attempt to thread a router instance through `apiFetch`.
- **Coder discretion:** exact Tailwind styling of the login/signup forms and dashboard placeholder is unspecified by design — Day 5 (5.1) is the dedicated styling pass; this task only needs the structure/testids/behavior above to be correct and reasonably presentable, not polished.
- **Deferred, not skipped:** backlog item 1.6's manual browser QA pass (real signup/login/logout/redirect click-through against a live dev server) is out of scope for this automated pipeline run — flagged here so it isn't mistaken for "done" once this task's automated tests pass.
