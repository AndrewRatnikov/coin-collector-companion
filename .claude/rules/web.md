---
paths:
  - "apps/web/**"
---

# apps/web (Next.js 16 + React 19 + vitest + RTL + jsdom) gotchas

## Tests that fail for environment reasons, not logic
- **`<input type="email">` blocks submit in jsdom** when the value fails native email validation (e.g. `'not-an-email'`): `onSubmit` never fires and `waitFor` just times out. For "server rejects this email" cases, use a value the browser accepts but `class-validator` `IsEmail()` rejects, e.g. `'user@localhost'`.
- **`use(promise)` inside `<Suspense>` never re-renders after resolving** in this test environment (reproduces 100%, works in a real browser). This breaks the standard `use(params)` pattern for App Router dynamic routes. Use `useEffect` + `useState` (`params.then(p => setX(p.id))`) instead, and render a minimal shell until the value is non-null. Do this for every `[param]` route.
- **`user.clear()` + `user.type()` on a pre-filled controlled input appends** instead of replacing ("My Wheat CentsRenamed Set"). Use `fireEvent.change(input, { target: { value: 'new' } })` to replace a value wholesale.

## Component patterns
- **Don't seed editable local state from query data with `useEffect`.** The first render after data arrives paints the stale initial value, and RTL's `waitFor` can resolve on that paint, which makes the test flaky. Use the render-time "adjust state" pattern instead: keep a ref of the last-synced query result, and when it differs, call the setter during render. (Hit in `sets/[id]/page.tsx`'s rename input.)
- **`fieldErrorsFrom(details, fields)` should only run on HTTP 400.** It matches messages by field-name prefix, so a 409 like `"Email already registered"` gets misrouted into the email field. Only the `ValidationPipe`'s 400 returns per-field messages; treat every other status as a page-level error.

## `apiFetch` (`src/lib/api-client.ts`)
- On a 401 with a token attached, it first tries one silent `POST /auth/refresh` + retry, then clears the token and redirects to `/login`.
- Some guarded mutations legitimately return 401 without the session being invalid (e.g. `PATCH /auth/password` for a wrong current password). Their API wrapper must pass the third argument `{ skipAuthRedirectOn401: true }`, otherwise a typo logs the user out. Reuse this opt-out; don't invent a new mechanism.
