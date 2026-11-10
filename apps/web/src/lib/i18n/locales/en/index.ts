import account from './account';
import addCoins from './add-coins';
import browseSets from './browse-sets';
import catalog from './catalog';
import collection from './collection';
import common from './common';
import glossary from './glossary';
import grades from './grades';
import setNew from './set-new';
import sets from './sets';

// English is the source of truth: every value here must stay byte-identical to
// the string that was hardcoded at each phrase's call site before i18n was
// introduced, so existing behavior (and any test asserting exact copy) never
// drifts. The keys live in one file per area (`./<area>.ts`); this file merges
// them. `MessageKey` below is derived from `enShape`'s literal keys (the spread
// of the area objects), and `locales/es/` is compile-time checked against it
// (see `../es/index.ts`, and each `es/<area>.ts` against its `en/<area>.ts`).
//
// `enShape`'s literal-keyed type is what makes `MessageKey` a precise union
// (not `string`) for `es/`'s parity check. The default export below is
// widened to `Record<string, string>` so callers can index it with a plain
// `string` (e.g. `Object.keys(en)` in a test) without a TS7053 index-signature
// error — `Record<string, string>` is structurally assignable back to
// `Record<MessageKey, string>` wherever a specific key is expected, so nothing
// downstream loses precision.
//
// A new key goes into the matching `en/<area>.ts` and `es/<area>.ts`; a new key
// prefix also goes into `AREA_PREFIXES` in `../dictionaries.test.ts`.
const enShape = {
  ...common,
  ...account,
  ...browseSets,
  ...collection,
  ...catalog,
  ...grades,
  ...sets,
  ...setNew,
  ...glossary,
  ...addCoins,
} satisfies Record<string, string>;

const en: Record<string, string> = enShape;
export default en;
export type MessageKey = keyof typeof enShape;
