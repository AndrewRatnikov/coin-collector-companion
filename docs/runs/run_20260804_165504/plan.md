# Technical Plan: Feedback form in Settings

**Run:** run_20260804_165504
**Date:** 2026-08-04

## Summary

Adds a second, route-based tab ("Feedback") to the existing single-page Settings area, following this repo's established tab pattern (`SetsTabs` + `/sets/canonical` + `/sets/public`). The new tab hosts a text-only feedback form that POSTs to a new authenticated NestJS `feedback` module, which persists a row (`userId` FK + `text`) via a new Prisma `Feedback` model. The existing Account tab (current `/settings` content: account info + change password) is preserved byte-for-byte except for the addition of the shared tabs component.

## Approach

1. **Backend data model.** Add a `Feedback` model to `apps/api/prisma/schema.prisma` (`id`, `userId` FK → `User.id` with `onDelete: Cascade`, `text`, `createdAt`), plus the corresponding `feedbacks Feedback[]` back-relation on `User`. Author a hand-written migration SQL file mirroring the existing `20260802224500_add_refresh_token` migration's style (this repo's migrations are committed to git, per `CLAUDE.md`'s note that `prisma/migrations/` is deliberately maintained, not regenerated ad hoc).

2. **Backend module.** New `apps/api/src/feedback/` module (controller + service + DTO + module), wired into `app.module.ts`'s `imports`. The route is `POST /api/v1/feedback` (global prefix already applied in `main.ts`). It carries **no** `@Public()` decorator, so it is protected by the app's existing global `JwtAuthGuard` (`APP_GUARD` in `app.module.ts`) by default — the same "protected unless explicitly public" convention `CollectionController` already uses. This satisfies PRD criterion #7's server-side auth requirement without any new guard code. The DTO validates `text` as a non-empty, trimmed string with `@MaxLength(2000)` (criterion #8), consistent with `CreateCoinDto`'s trim-then-validate `@Transform` pattern. The service only ever does a plain `prisma.feedback.create(...)` — no Prisma error-code branching (`P2002`/`P2003`) is needed since `userId` always comes from a verified JWT (`@CurrentUser()`), so a FK violation cannot practically occur; this deliberately avoids the `Prisma.PrismaClientKnownRequestError` sandbox-generation gotcha (`memory.md`, run_20260720_142942/171320) rather than needing to work around it, so **the sandbox Test command below does not need a `prisma generate` step.**

3. **Shared types.** Add `SubmitFeedbackRequest` and `FeedbackResponse` interfaces to `packages/shared/src/index.ts`, following the existing request/response interface-pair convention (e.g. `SetOwnershipRequest`/`SetOwnershipResponse`). `FeedbackResponse` intentionally has no `email` field — the PRD's "(or id in users table)" alternative is the one taken: only `userId` is stored/returned; email is resolvable later via the `User` relation if ever needed, never duplicated.

4. **Frontend tabs.** New shared `SettingsTabs` component (`apps/web/src/components/layout/settings-tabs.tsx`), directly modeled on the existing `SetsTabs` (`apps/web/src/components/layout/sets-tabs.tsx`) — same `usePathname()` + `Link` + `data-testid` shape. Unlike `SetsTabs` (whose two hrefs, `/sets/canonical` and `/sets/public`, are mutually non-prefixing), `SettingsTabs`'s two hrefs are `/settings` and `/settings/feedback`, where `/settings` **is** a prefix of `/settings/feedback` — so active-tab detection must use exact equality (`pathname === tab.href`), not `startsWith`, or the Account tab would show active on the Feedback route too.

5. **Frontend routes.** `apps/web/src/app/settings/page.tsx` (Account tab, existing route) is modified minimally: add a `<SettingsTabs />` render at the top of `SettingsContent`, before the `<h1>`. No other existing markup, state, or logic changes. A new `apps/web/src/app/settings/feedback/page.tsx` (Feedback tab) is created, mirroring `settings/page.tsx`'s `RequireAuth` wrapper + `main` shell, rendering `<SettingsTabs />` + the same `settings.title` heading + the new `FeedbackForm`.

6. **Frontend form.** New `FeedbackForm` component (`apps/web/src/components/settings/feedback-form.tsx`), modeled on `ChangePasswordForm`'s (`apps/web/src/app/settings/page.tsx`) state/submit/error-display shape: local `text` state, a client-side empty/whitespace check and a client-side `2000`-char check (criteria #6, #8) that block submission and render a field-level validation message (via a `feedback-text-error` element id, same convention as `ChangePasswordForm`'s `newPassword-error`/`confirmNewPassword-error` — not a `data-testid`), a TanStack Query mutation (`useSubmitFeedback`) for the actual POST, a `settings-feedback-error` testid for server/network failures, and a `settings-feedback-success` testid + input-clear on success (criteria #4, #5 — on failure the typed text is deliberately left in place, satisfying criterion #5's "preserves the user's typed text").

7. **Frontend API/hook layer.** New `apps/web/src/lib/feedback-api.ts` (`submitFeedback(text)` calling `apiFetch<FeedbackResponse>('/feedback', { method: 'POST', ... })`, mirrors `collection-api.ts`) and `apps/web/src/lib/hooks/use-feedback.ts` (`useSubmitFeedback()` wrapping it in `useMutation`, mirrors `use-collection.ts`'s `useSetOwnership`).

8. **i18n.** New keys added to **both** `en.ts` and `es.ts` (required for this repo's compile-time `Record<MessageKey, string>` parity check on `es.ts` and the runtime parity assertion in the existing `dictionaries.test.ts`): `settings.accountTabLabel`, `settings.feedbackTabLabel`, `settings.feedbackTitle`, `settings.feedbackTextLabel`, `settings.feedbackSubmit`, `settings.feedbackSuccess`, `settings.feedbackError`, `settings.feedbackValidationEmpty`, `settings.feedbackValidationTooLong`.

9. **Existing test file requiring modification (Tester's responsibility, not Coder's — see note below).** `apps/web/src/app/settings/page.test.tsx` currently does `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: replaceMock }) }))` — a **full module replacement** that exports only `useRouter`. Once `SettingsPage` renders `<SettingsTabs />`, which calls `usePathname()`, every existing test in this file will throw (`usePathname is not a function`) unless the mock is extended to also export `usePathname: () => '/settings'`. This must be fixed as part of the same test-file edit that adds the new tab-presence assertions — it is not optional and not a new criterion, it is a pre-existing test file breaking as a side effect of criterion #1's tab addition. The new `settings/feedback/page.test.tsx` test file needs its own `next/navigation` mock with both `useRouter` (for `RequireAuth`) and `usePathname: () => '/settings/feedback'` (for `SettingsTabs`), for the same reason.

**Edge cases handled:** empty/whitespace-only submission blocked client-side (#6); over-length text blocked both client-side and server-side (#8); server error leaves typed text intact (#5); unauthenticated access blocked both by `RequireAuth` (page-level) and the global `JwtAuthGuard` (API-level, #7); switching tabs is a real Next.js route change (unmount/remount), which trivially gives each tab's form independent, un-shared state (#1) — no extra state-reset code is needed for this.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/prisma/schema.prisma` | MODIFY | Add `Feedback` model + `User.feedbacks` back-relation |
| `apps/api/prisma/migrations/20260804173000_add_feedback/migration.sql` | CREATE | SQL migration creating the `Feedback` table + FK + index |
| `apps/api/src/feedback/dto/submit-feedback.dto.ts` | CREATE | Validates/trims the feedback `text` field |
| `apps/api/src/feedback/feedback.service.ts` | CREATE | Persists a feedback row via Prisma |
| `apps/api/src/feedback/feedback.controller.ts` | CREATE | `POST /feedback` (auth required, no `@Public()`) |
| `apps/api/src/feedback/feedback.module.ts` | CREATE | Nest module wiring controller + service |
| `apps/api/src/app.module.ts` | MODIFY | Register `FeedbackModule` in `imports` |
| `packages/shared/src/index.ts` | MODIFY | Add `SubmitFeedbackRequest` / `FeedbackResponse` types |
| `apps/web/src/components/layout/settings-tabs.tsx` | CREATE | Account/Feedback tab nav (route-based, like `SetsTabs`) |
| `apps/web/src/app/settings/page.tsx` | MODIFY | Render `<SettingsTabs />` above existing Account content |
| `apps/web/src/app/settings/feedback/page.tsx` | CREATE | New Feedback tab route, `RequireAuth`-wrapped |
| `apps/web/src/components/settings/feedback-form.tsx` | CREATE | The feedback textarea form itself |
| `apps/web/src/lib/feedback-api.ts` | CREATE | `submitFeedback()` — POST `/feedback` |
| `apps/web/src/lib/hooks/use-feedback.ts` | CREATE | `useSubmitFeedback()` mutation hook |
| `apps/web/src/lib/i18n/locales/en.ts` | MODIFY | Add the 9 new `settings.*` keys (English) |
| `apps/web/src/lib/i18n/locales/es.ts` | MODIFY | Add the same 9 keys (Spanish) — required for compile-time parity |

*(The Tester additionally modifies `apps/web/src/app/settings/page.test.tsx` and creates `apps/web/src/app/settings/feedback/page.test.tsx` — these are test files under the Tester's ownership, not part of the Coder's `Files changed` copy step above.)*

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Shared types: `packages/shared/src/index.ts` (MODIFY — additive only)

```typescript
export interface SubmitFeedbackRequest {
  text: string;
}

export interface FeedbackResponse {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
}
```

No existing export in this file is changed or removed.

### Backend DTO: SubmitFeedbackDto

- **File:** `apps/api/src/feedback/dto/submit-feedback.dto.ts`
- **Export:** `export class SubmitFeedbackDto`
- **Shape:**
  ```typescript
  export class SubmitFeedbackDto {
    text!: string; // @Transform trim, @IsString(), @IsNotEmpty(), @MaxLength(2000)
  }
  ```
- **Dependencies:** `@nestjs/swagger` (`ApiProperty`), `class-transformer` (`Transform`), `class-validator` (`IsString`, `IsNotEmpty`, `MaxLength`) — all already installed, same imports `create-coin.dto.ts` uses.

### Backend service: FeedbackService

- **File:** `apps/api/src/feedback/feedback.service.ts`
- **Export:** `export class FeedbackService` (`@Injectable()`)
- **Constructor:** `constructor(private readonly prisma: PrismaService)`
- **Method:** `submit(userId: string, text: string): Promise<FeedbackResponse>` — calls `this.prisma.feedback.create({ data: { userId, text } })` and returns the created row directly (its shape already matches `FeedbackResponse`).
- **Dependencies:** `PrismaService` (`../prisma/prisma.service`), `FeedbackResponse` (`@coin-collector/shared`).

### Backend controller: FeedbackController

- **File:** `apps/api/src/feedback/feedback.controller.ts`
- **Export:** `export class FeedbackController` (`@Controller('feedback')`, `@ApiTags('feedback')`, `@ApiBearerAuth()`)
- **Method:** `create(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitFeedbackDto): Promise<FeedbackResponse>` decorated `@Post()`, calling `this.feedbackService.submit(user.userId, dto.text)`.
- **No `@Public()` decorator anywhere in this file** — this is load-bearing for criterion #7 and must be asserted by a controller test (`Reflector.get(IS_PUBLIC_KEY, controller.create)` is falsy), mirroring `collection.controller.spec.ts`'s existing `@Public()`-metadata test pattern.
- **Dependencies:** `CurrentUser` (`../auth/decorators/current-user.decorator`), `AuthenticatedUser` (`../auth/strategies/jwt.strategy`), `FeedbackService`, `SubmitFeedbackDto`.

### Backend module: FeedbackModule

- **File:** `apps/api/src/feedback/feedback.module.ts`
- **Export:** `export class FeedbackModule` (`@Module({ controllers: [FeedbackController], providers: [FeedbackService] })`)

### `apps/api/src/app.module.ts` (MODIFY)

- Add `import { FeedbackModule } from './feedback/feedback.module';` and add `FeedbackModule` to the `imports` array (alongside `CatalogModule`, `SetsModule`, `CollectionModule`). No other change to this file.

### Prisma schema: `apps/api/prisma/schema.prisma` (MODIFY)

Add this model:
```prisma
model Feedback {
  id        String   @id @default(uuid())
  userId    String
  text      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```
Add `feedbacks Feedback[]` to the existing `User` model's relation list (alongside `userSets`, `ownerships`, `submittedCoins`, `refreshTokens`).

### Migration: `apps/api/prisma/migrations/20260804173000_add_feedback/migration.sql`

```sql
-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Component: `SettingsTabs`

- **File:** `apps/web/src/components/layout/settings-tabs.tsx`
- **Export:** `export function SettingsTabs()` (named export, no props — same as `SetsTabs`)
- **Behavior:** renders two `Link`s from a `TABS` array `[{ href: '/settings', testId: 'settings-tab-account', labelKey: 'settings.accountTabLabel' }, { href: '/settings/feedback', testId: 'settings-tab-feedback', labelKey: 'settings.feedbackTabLabel' }]`. Active-tab check is **exact match**: `const isActive = pathname === tab.href;` (not `startsWith` — see Approach step 4 for why).
- **Test selectors:**
  - `data-testid="settings-tabs"` — root wrapper `div`
  - `data-testid="settings-tab-account"` — link to `/settings`
  - `data-testid="settings-tab-feedback"` — link to `/settings/feedback`
- **Dependencies:** `next/link`, `next/navigation` (`usePathname`), `useTranslation` (`@/lib/i18n/i18n-context`), `MessageKey` (`@/lib/i18n/locales/en`).

### Page: `SettingsPage` (Account tab) — `apps/web/src/app/settings/page.tsx` (MODIFY)

- **Export:** `export default function SettingsPage()` — unchanged signature/export.
- **Change:** inside the inner `SettingsContent` component, add `<SettingsTabs />` as the first child of the `<main data-testid="settings-page">` element, immediately before the existing `<h1>`. No other JSX, state, or import in this file changes except the new `import { SettingsTabs } from '@/components/layout/settings-tabs';`.
- **Test selectors (all pre-existing, unchanged, listed here so the mechanical contract gate recognizes them against the still-passing existing test file):**
  - `data-testid="settings-page"` — root `main`
  - `data-testid="settings-loading"` — loading skeleton
  - `data-testid="settings-error"` — query error message
  - `data-testid="settings-account-info"` — account info block
  - `data-testid="settings-email"` — email text
  - `data-testid="settings-member-since"` — member-since text
  - `data-testid="settings-change-password-form"` — change-password form
  - `data-testid="settings-change-password-error"` — change-password form-level error
  - `data-testid="settings-change-password-success"` — change-password success message
  - `data-testid="settings-change-password-submit"` — change-password submit button
  - Plus the new: `data-testid="settings-tabs"`, `data-testid="settings-tab-account"`, `data-testid="settings-tab-feedback"` (rendered via `<SettingsTabs />`)

### Page: SettingsFeedbackPage (Feedback tab, CREATE)

- **File:** `apps/web/src/app/settings/feedback/page.tsx`
- **Export:** `export default function SettingsFeedbackPage()`
- **Structure:** `RequireAuth` wrapping a `main`:
  ```tsx
  <RequireAuth>
    <main data-testid="settings-feedback-page" className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]">
      <SettingsTabs />
      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('settings.title')}</h1>
      <FeedbackForm />
    </main>
  </RequireAuth>
  ```
- **Test selectors:**
  - `data-testid="settings-feedback-page"` — root `main` (only rendered once `RequireAuth` authorizes; same gating behavior as `settings-page`, reuses `RequireAuth`'s own existing pending-state testid — an already-implemented, untouched selector in `require-auth.tsx`, not a new one — for the pending state)
  - (tab testids `settings-tabs`/`settings-tab-account`/`settings-tab-feedback` also appear here, already declared above)
  - Plus every testid declared in the `FeedbackForm` block below
- **Dependencies:** `RequireAuth` (`@/components/auth/require-auth`), `SettingsTabs` (`@/components/layout/settings-tabs`), `FeedbackForm` (`@/components/settings/feedback-form`), `useTranslation` (`@/lib/i18n/i18n-context`).

### Component: `FeedbackForm`

- **File:** `apps/web/src/components/settings/feedback-form.tsx`
- **Export:** `export function FeedbackForm()` — named export, no props.
- **Behavior:**
  - Local state: `text` (string), `validationError` (string), `formError` (string), `successMessage` (string).
  - On submit: trims `text`; if empty → sets `validationError` from `t('settings.feedbackValidationEmpty')`, no request sent. If `trimmed.length > 2000` → sets `validationError` from `t('settings.feedbackValidationTooLong')`, no request sent. Otherwise calls `useSubmitFeedback().mutate({ text: trimmed }, { onSuccess, onError })`.
  - `onSuccess`: sets `successMessage` from `t('settings.feedbackSuccess')`, clears `text` to `''`.
  - `onError`: if `error instanceof ApiError`, sets `formError` from `error.details.join(', ')`; otherwise sets `formError` from `t('settings.feedbackError')`. Typed `text` is **not** cleared on error.
- **Test selectors:**
  - `data-testid="settings-feedback-form"` — root `form`
  - `data-testid="settings-feedback-submit"` — submit button
  - `data-testid="settings-feedback-error"` — server/network error message
  - `data-testid="settings-feedback-success"` — success message
  - The textarea itself has `id="feedback-text"` (not a `data-testid` — referenced via `document.getElementById`, matching this repo's established convention for `ChangePasswordForm`'s inputs)
  - The client-side validation message has `id="feedback-text-error"` (not a `data-testid` — same `document.getElementById` convention as `ChangePasswordForm`'s `newPassword-error`/`confirmNewPassword-error`)
- **Dependencies:** `useSubmitFeedback` (`@/lib/hooks/use-feedback`), `ApiError` (`@/lib/api-client`), `useTranslation` (`@/lib/i18n/i18n-context`).

### Frontend API: feedback-api

- **File:** `apps/web/src/lib/feedback-api.ts`
- **Export:** `export async function submitFeedback(text: string): Promise<FeedbackResponse>`
- **Body:** `return apiFetch<FeedbackResponse>('/feedback', { method: 'POST', body: JSON.stringify({ text } satisfies SubmitFeedbackRequest) });`
- **Dependencies:** `apiFetch` (`./api-client`), `FeedbackResponse`/`SubmitFeedbackRequest` (`@coin-collector/shared`).

### Frontend hook: use-feedback

- **File:** `apps/web/src/lib/hooks/use-feedback.ts`
- **Export:** `export function useSubmitFeedback()`
- **Body:** `return useMutation<FeedbackResponse, ApiError, { text: string }>({ mutationFn: ({ text }) => submitFeedback(text) });`
- **Dependencies:** `useMutation` (`@tanstack/react-query`), `ApiError` (`@/lib/api-client`), `submitFeedback` (`@/lib/feedback-api`), `FeedbackResponse` (`@coin-collector/shared`).

### i18n keys — `apps/web/src/lib/i18n/locales/en.ts` and `es.ts` (MODIFY, both files)

| Key | English | Spanish |
|-----|---------|---------|
| `settings.accountTabLabel` | `Account` | `Cuenta` |
| `settings.feedbackTabLabel` | `Feedback` | `Comentarios` |
| `settings.feedbackTitle` | `Send feedback` | `Enviar comentarios` |
| `settings.feedbackTextLabel` | `Your feedback` | `Tus comentarios` |
| `settings.feedbackSubmit` | `Submit feedback` | `Enviar comentarios` |
| `settings.feedbackSuccess` | `Thanks for your feedback!` | `¡Gracias por tus comentarios!` |
| `settings.feedbackError` | `Something went wrong sending your feedback. Please try again.` | `Ocurrió un error al enviar tus comentarios. Inténtalo de nuevo.` |
| `settings.feedbackValidationEmpty` | `Please enter some feedback before submitting.` | `Escribe algún comentario antes de enviar.` |
| `settings.feedbackValidationTooLong` | `Feedback must be 2000 characters or fewer.` | `Los comentarios deben tener 2000 caracteres o menos.` |

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. Settings has Account + Feedback tabs, route-based, independent state | `SettingsTabs`, `settings/page.tsx` (MODIFY), `settings/feedback/page.tsx` (CREATE) |
| 2. Feedback tab has a text input + submit button | `FeedbackForm` (`feedback-text` textarea + `settings-feedback-submit` button) |
| 3. Submitting persists userId + text | `FeedbackController.create` → `FeedbackService.submit` → `prisma.feedback.create`, `Feedback` Prisma model |
| 4. Success shows confirmation + clears input | `FeedbackForm`'s `onSuccess` (sets `settings-feedback-success`, clears `text`) |
| 5. Failure shows error + preserves typed text | `FeedbackForm`'s `onError` (sets `settings-feedback-error`, does not clear `text`) |
| 6. Empty/whitespace text blocked client-side | `FeedbackForm`'s pre-submit trim+empty check (`feedback-text-error`, no request sent) |
| 7. Feedback reachable/submittable only when logged in | `RequireAuth` (page-level, existing), no `@Public()` on `FeedbackController.create` (API-level, global `JwtAuthGuard`) |
| 8. Max length enforced client- and server-side | `FeedbackForm`'s `2000`-char check + `SubmitFeedbackDto`'s `@MaxLength(2000)` |

## Risks and open questions

- **Sandbox Test command** (correcting `repo-digest.md`'s reported `UNKNOWN`, per `memory.md`'s recorded gotcha for this repo): `pnpm --filter api test && pnpm --filter web test`. `packages/shared`'s `dist/` gap is already handled generically by `run-tests.sh`'s automatic pre-test workspace-library build step (`memory.md`, run_20260728_071525) — no manual build step needed in this command. No `prisma generate` step is needed either, since (as explained in Approach step 2) this task's service code never constructs or checks `instanceof Prisma.PrismaClientKnownRequestError`.
- **Migration timestamp** (`20260804173000_add_feedback`) is chosen to sort after the latest existing migration (`20260802224500_add_refresh_token`); exact clock-time precision doesn't matter, only ordering.
- Left to the Coder's discretion: exact Tailwind utility classes on the textarea (should visually match `FormField`'s input styling, per Approach step 6, but `FormField` itself only supports `<input>`, not `<textarea>`, so the textarea markup is written inline in `FeedbackForm` rather than reusing `FormField`).
- No admin/list view of submitted feedback is built (PRD Out of scope) — `FeedbackResponse` exists only as the POST's return shape, not for any GET endpoint.
