# User flow map

Drawn 2026-11-25 from the code, updated 2026-11-25 for navigation Option A: the routes under `apps/web/src/app`, the nav items in `components/layout/` (`site-nav.tsx`, `mobile-tab-bar.tsx`, `account-menu.tsx`, `site-footer.tsx`, `sets-tabs.tsx`) and every `href` / `router.push` in pages and components. Update it when navigation changes.

## Signed in

Nav (desktop bar and phone tab bar): My sets, Checklists, Catalog, Collection. Account menu: Settings, My submissions, Import from CSV (and Admin for admins). Footer: Glossary, Send feedback, Privacy.

```mermaid
flowchart TB
  subgraph NAV["Top nav and phone tab bar"]
    direction LR
    MS["My sets<br/>/dashboard"]
    CL["Checklists<br/>/sets/canonical"]
    CAT["Catalog<br/>/catalog"]
    COL["Collection<br/>/collection"]
  end
  subgraph ACC["Account menu"]
    direction LR
    SET["Settings<br/>/settings"]
    MINE["My submissions<br/>/catalog/mine"]
    IMP["Import CSV<br/>/collection/import"]
  end
  MS --> SETP["Set page<br/>/sets/:id"]
  MS --> NEW["New set<br/>/sets/new"]
  MS -- "Want list button" --> WL["Want list<br/>/want-list"]
  MS -- "Missing tile" --> WL
  MS -- "Collection tile" --> COL
  MS -- "Next set suggestion" --> NEW
  CL <-- "tabs" --> PUB["Collectors' sets<br/>/sets/public"]
  CL --> CLD["Checklist<br/>/sets/canonical/:id"]
  PUB --> PUBD["Public set<br/>/sets/public/:id"]
  CLD -- "Start this set" --> NEW
  PUBD -- "Start this set" --> NEW
  NEW -- "step 1 lists checklists and public sets" --> NEW
  NEW -- "create" --> SETP
  SETP -- "Add coins sheet (in-page catalog search)" --> SETP
  SETP -- "menu: Print missing" --> MISS["Set want list<br/>/sets/:id/missing"]
  SETP -- "breadcrumb" --> MS
  MISS -.-> WL
  SETP --> COIN["Coin page<br/>/catalog/:id"]
  CAT --> COIN
  COL --> COIN
  COL --> IMP
  COIN -- "In your sets" --> SETP
  COIN -- "Add to set (existing sets or new)" --> NEW
  CLD --> COIN
  PUBD --> COIN
  WL -- "Which sets?" --> SETP
  MINE --> COIN
  classDef nav fill:#EEEDFE,stroke:#534AB7,color:#3C3489
  class MS,CL,CAT,COL nav
```

## Signed out

Nav: Catalog, Checklists (`/sets`, which redirects to `/sets/canonical`), Log in, Create account. Phone tab bar: Catalog, Checklists, Glossary. `/` is the landing page; signed-in visitors are redirected from `/` to `/dashboard`.

```mermaid
flowchart TB
  LAND["Landing<br/>/"] -- "Create a free account" --> SIGNUP["Sign up<br/>/signup"]
  LAND -- "Browse checklists" --> CL["Checklists<br/>/sets/canonical"]
  LAND -- "Ways in" --> CAT["Catalog<br/>/catalog"]
  LAND -- "Ways in" --> PUB["Collectors' sets<br/>/sets/public"]
  CL <-- "tabs" --> PUB
  CL --> CLD["Checklist<br/>/sets/canonical/:id"]
  PUB --> PUBD["Public set<br/>/sets/public/:id"]
  CAT --> COIN["Coin page<br/>/catalog/:id"]
  CLD --> COIN
  PUBD --> COIN
  CLD -- "Start this set" --> LOGIN["Log in<br/>/login"]
  PUBD -- "Start this set" --> LOGIN
  LOGIN -- "Forgot password" --> FP["/forgot-password"] --> RP["/reset-password"] --> LOGIN
  LOGIN --> DASH["My sets<br/>/dashboard"]
  SIGNUP --> DASH
```

## What the map shows

1. **Checklists and collectors' sets were not in the signed-in nav** (addressed 2026-11-25): Checklists is now a nav item and phone tab linking to `/sets/canonical`, reachable with or without sets; the "Browse checklists" text links on My sets are gone.
2. **On those pages the nav highlighted "My sets"** (addressed 2026-11-25): `getActiveNavItem` now marks `/sets/canonical*` and `/sets/public*` as Checklists; own sets, the new-set form and the want list stay under My sets.
3. **The combined want list had no clear entry** (addressed 2026-11-25): My sets has a secondary "Want list" button beside New set (beside "Your sets" on the phone) whenever the user has a set, besides the "missing" tile and the link on a set's want list.
4. **Catalog is in the nav, but nothing points to it from My sets or a set page.** From a set, coins are added through the Add coins sheet; the catalog page itself is only one hop away through the nav.
5. **Glossary is footer-only when signed in.**
