import type { MessageKey } from '../en';
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

// The keys live in one file per area (`./<area>.ts`), each explicitly typed
// against its English counterpart (`Record<keyof typeof en<Area>, string>`), so
// a missing or extra key is a `tsc --noEmit` compile error in that area file.
// `esShape` is also explicitly typed as `Record<MessageKey, string>` (not
// inferred), which checks the whole dictionary (e.g. a missing spread) — this
// is what enforces en/es key parity, not a convention. Spanish copy here is
// stub/placeholder quality; a native-speaker review pass is a follow-up task,
// not this one. The default export is then widened to `Record<string, string>`
// for the same reason as `en/index.ts` — see that file's comment.
const esShape: Record<MessageKey, string> = {
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
};

const es: Record<string, string> = esShape;
export default es;
