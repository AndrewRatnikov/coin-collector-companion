# Reference files: signed-out landing page (2026-11-16)

Exported from the Claude Design canvas (the "Landing (signed out)" page). The `.dc.html` files are templates: `{{holes}}`, `<sc-for>` and `<sc-if>`, plus a `renderVals()` script with sample data. Read them for structure and exact values; they don't run as plain HTML.

The stylesheet `<link href="/_blob/9289bb8d…">` points to `../2026-10-17_signed-in-redesign/classical.css`.

| File | What |
|---|---|
| `L_Landing.dc.html` | Desktop, 1440. Tweaks: variant (A read-only, B try-it), state (normal, server waking, API error), lang (en, es), headline, counts |
| `L_LandingMobile.dc.html` | Mobile, 390, with an EN/ES Tweak |
| `L_SocialCard.dc.html` | Social preview, 1200×630. Export it as a PNG from the canvas |
| `en-landing.ts` | Every English string, ready to copy into `apps/web/src/lib/i18n/locales/en/landing.ts` |
| `es-landing.ts` | Every Spanish string, ready to copy into `apps/web/src/lib/i18n/locales/es/landing.ts` |

The counts in the mock are illustrative. Real values come from the API, with the fallbacks described in the brief.
