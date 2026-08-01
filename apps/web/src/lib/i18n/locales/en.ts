// English is the source of truth: every value here must stay byte-identical to
// the string that was hardcoded at each phrase's call site before i18n was
// introduced, so existing behavior (and any test asserting exact copy) never
// drifts. `MessageKey` below is derived from this object's literal keys, and
// `locales/es.ts` is compile-time checked against it (see that file).
//
// `enShape`'s literal-keyed type is what makes `MessageKey` a precise union
// (not `string`) for `es.ts`'s parity check. The default export below is
// widened to `Record<string, string>` so callers can index it with a plain
// `string` (e.g. `Object.keys(en)` in a test) without a TS7053 index-signature
// error — `Record<string, string>` is structurally assignable back to
// `Record<MessageKey, string>` wherever a specific key is expected, so nothing
// downstream loses precision.
const enShape = {
  // nav
  'nav.catalog': 'Catalog',
  'nav.sets': 'Sets',
  'nav.canonicalSets': 'Canonical Sets',
  'nav.publicSets': 'Public Sets',
  'nav.dashboard': 'Dashboard',
  'nav.collection': 'Collection',
  'nav.mySubmissions': 'My Submissions',
  'nav.logOut': 'Log out',
  'nav.logIn': 'Log in',
  'nav.brand': 'Coin Collector Companion',
  'nav.signUp': 'Sign up',
  'nav.glossary': 'Glossary',
  'nav.account': 'Account',

  // language switcher
  'languageSwitcher.english': 'English',
  'languageSwitcher.spanish': 'Spanish',

  // shared across multiple pages/forms
  'common.somethingWentWrong': 'Something went wrong. Please try again.',
  'common.email': 'Email',
  'common.password': 'Password',
  'common.country': 'Country',
  'common.denomination': 'Denomination',
  'common.name': 'Name',
  'common.yearMin': 'Year min',
  'common.yearMax': 'Year max',
  'common.year': 'Year',
  'common.mintMark': 'Mint mark',
  'common.variety': 'Variety',
  'common.search': 'Search',
  'common.prev': 'Prev',
  'common.next': 'Next',
  'common.pagePrefix': 'Page',
  'common.ofSeparator': 'of',
  'common.owned': 'owned',
  'common.missing': 'missing',
  'common.clear': 'Clear',
  'common.close': 'Close',
  'common.cancel': 'Cancel',

  // home
  'home.title': 'Coin Collector Companion',
  'home.eyebrow': 'Est. catalogue & personal ledger',
  'home.headline': 'A quiet place to record what you have — and what you are still looking for.',
  'home.paragraph':
    'Define a set on your own terms, mark the coins you own, and see the gaps that remain. Browsing needs no account.',
  'home.browseCatalogue': 'Browse the catalogue',
  'home.browseCanonical': 'Browse canonical sets',
  'home.browsePublic': "Browse collectors' sets",
  'home.coinsUnit': 'coins',
  'home.setsUnit': 'sets',

  // login
  'login.title': 'Log in',
  'login.submit': 'Log in',

  // signup
  'signup.title': 'Sign up',
  'signup.confirmPasswordLabel': 'Confirm password',
  'signup.passwordsDoNotMatch': 'Passwords do not match',
  'signup.submit': 'Sign up',

  // dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.errorLoadingSets': 'Something went wrong loading your sets. Please try again.',
  'dashboard.emptyMessage': "You don't have any sets yet.",
  'dashboard.startFirstSetCta': 'Start your first set',
  'dashboard.statSets': 'Sets',
  'dashboard.statCoinsOwned': 'Coins owned',
  'dashboard.statAverageCompletion': 'Average completion',

  // collection
  'collection.title': 'My Collection',
  'collection.errorLoading': 'Something went wrong loading your collection. Please try again.',
  'collection.emptyMessage': "You don't own any coins yet.",

  // catalog
  'catalog.title': 'Catalog',
  'catalog.addCoinCta': "Can't find this coin? Add it",
  'catalog.addCoinSheetTitle': 'Add a coin',
  'catalog.errorLoading': 'Something went wrong loading the catalog. Please try again.',
  'catalog.emptyMessage': 'No coins found.',

  // coin detail
  'coinDetail.errorLoading': 'Something went wrong loading this coin. Please try again.',
  'coinDetail.pendingBadge': 'Pending review',
  'coinDetail.imageAttributionPrefix': 'Image:',
  'coinDetail.unknownSource': 'Unknown source',
  'coinDetail.markOwned': 'Mark as owned',
  'coinDetail.removeOwned': 'Remove from collection',
  'coinDetail.inCollection': 'In your collection',
  'coinDetail.loginPrompt': 'Log in to record this coin in your collection.',
  'coinDetail.appearsInSets': 'Appears in your sets',

  // submit coin form
  'submitCoinForm.submit': 'Submit coin',

  // submission confirmation
  'submissionConfirmation.addToSetButton': 'Add to this set',
  'submissionConfirmation.createSetSubmit': 'Create set and add coin',
  'submissionConfirmation.viewSetLink': 'View set',

  // set editor
  'setEditor.renameSubmit': 'Rename',
  'setEditor.deleteButton': 'Delete set',
  'setEditor.deleteConfirmTitle': 'Delete this set?',
  'setEditor.deleteConfirmMessage': 'This action cannot be undone.',
  'setEditor.markNotOwned': 'Mark not owned',
  'setEditor.markOwned': 'Mark owned',
  'setEditor.removeButton': 'Remove',
  'setEditor.addCoinsHeading': 'Add coins',
  'setEditor.addButton': 'Add',
  'setEditor.errorLoading': 'Something went wrong loading this set. Please try again.',
  'setEditor.allCoins': 'All coins',
  'setEditor.missing': 'missing',
  'setEditor.addCoins': 'Add coins',
  'setEditor.closePicker': 'Close picker',
  'setEditor.undo': 'Undo',
  'setEditor.noCoinsYet': 'No coins yet — add some below.',

  // canonical sets
  'canonicalSets.title': 'Canonical sets',
  'canonicalSets.errorLoading': 'Something went wrong loading canonical sets. Please try again.',
  'canonicalSets.emptyMessage': 'No canonical sets yet.',

  // canonical set detail
  'canonicalSetDetail.errorLoading': 'Something went wrong loading this canonical set. Please try again.',
  'canonicalSetDetail.cloneCta': 'Clone into my sets',

  // new set
  'setNew.title': 'Start a new set',
  'setNew.startFromLegend': 'Start from',
  'setNew.modeBlank': 'Blank set',
  'setNew.modeCanonical': 'Clone a canonical set',
  'setNew.modePublic': 'Clone a public set',
  'setNew.selectCanonicalPlaceholder': 'Select a canonical set…',
  'setNew.selectPublicPlaceholder': 'Select a public set…',
  'setNew.defaultError': 'Something went wrong creating the set.',
  'setNew.submit': 'Create set',
  'setNew.chooseCanonical': 'Choose a canonical set',
  'setNew.choosePublic': "Choose a collector's set",
  'setNew.inThisSet': 'In this set',
  'setNew.nothingAdded': 'Nothing added yet.',
  'setNew.add': 'Add',
  'setNew.remove': 'Remove',
  'setNew.createSet': 'Create Set',
  'setNew.addFromCatalogue': 'Add from the catalogue',

  // public sets
  'publicSets.title': 'Public sets',
  'publicSets.errorLoading': 'Something went wrong loading public sets. Please try again.',
  'publicSets.emptyMessage': 'No public sets yet.',

  // public set detail
  'publicSetDetail.errorLoading': 'Something went wrong loading this set. Please try again.',
  'publicSetDetail.cloneCta': 'Clone into my sets',
  'publicSetDetail.overlap': 'You already own',

  // my submissions
  'mySubmissions.title': 'My Submissions',
  'mySubmissions.errorLoading': 'Something went wrong loading your submissions. Please try again.',
  'mySubmissions.emptyMessage': "You haven't submitted any coins yet.",
  'mySubmissions.statusPending': 'Pending review',
  'mySubmissions.statusApproved': 'Approved',
  'mySubmissions.statusRejected': 'Not approved',

  // footer
  'footer.attributionPrefix': 'Catalog data derived from',
  'footer.wikipediaLinkText': 'Wikipedia',
  'footer.attributionSuffix': ', used under CC BY-SA 4.0.',

  // glossary
  'glossary.pageTitle': 'Glossary',
  'glossary.intro':
    'A quick reference for coin-collecting vocabulary — starting with terms this app uses directly, followed by general numismatic terms you may encounter elsewhere.',
  'glossary.appTermsHeading': 'Terms this app uses',
  'glossary.generalTermsHeading': 'General collecting terms',
  'glossary.term.canonicalSet': 'Canonical set',
  'glossary.definition.canonicalSet':
    'An admin-curated set of coins (e.g. "Lincoln Wheat Cents") that any user can clone as a starting point for their own collection.',
  'glossary.term.cloningASet': 'Cloning a set',
  'glossary.definition.cloningASet':
    "Copying another set's coin list into a new set of your own, either from a canonical set or from another user's public set. Ownership isn't copied — only the list of coins.",
  'glossary.term.completionPercentage': 'Completion percentage',
  'glossary.definition.completionPercentage':
    "The share of a set's coins you currently own, shown as a rounded percentage on the set's gap view.",
  'glossary.term.country': 'Country',
  'glossary.definition.country':
    'The issuing country of a coin (e.g. USA), one of the fields used to identify it in the catalog.',
  'glossary.term.denomination': 'Denomination',
  'glossary.definition.denomination': 'The face value of a coin (e.g. Cent, Nickel, Dollar).',
  'glossary.term.gapView': 'Gap view',
  'glossary.definition.gapView':
    'The list, for one of your sets, of which coins you already own and which are still missing.',
  'glossary.term.mintMark': 'Mint mark',
  'glossary.definition.mintMark':
    'A small letter on a coin showing which mint produced it (e.g. "S" for San Francisco, "D" for Denver). Coins with no mint mark were struck at the main Philadelphia mint.',
  'glossary.term.ownership': 'Ownership',
  'glossary.definition.ownership':
    'Marking a coin in the catalog as one you own. Ownership is global to your account — owning a coin once counts toward every set it appears in, not just one.',
  'glossary.term.publicSet': 'Public set',
  'glossary.definition.publicSet':
    "Any set built in this app is visible and cloneable by other users by default; there's no private-set option yet.",
  'glossary.term.userSet': 'User set',
  'glossary.definition.userSet':
    "A set you've built yourself, whether from scratch, by filtering the catalog, or by cloning a canonical or public set.",
  'glossary.term.variety': 'Variety',
  'glossary.definition.variety':
    'A distinguishing feature of a specific coin beyond year/mint mark (e.g. a design change or minting error), when the catalog records one.',
  'glossary.term.grade': 'Grade',
  'glossary.definition.grade':
    "A standardized rating of a coin's physical condition, from heavily worn to pristine (e.g. Good, Fine, Uncirculated).",
  'glossary.term.keyDate': 'Key date',
  'glossary.definition.keyDate':
    'A year (and sometimes mint mark) of a given coin type that was minted in unusually low numbers, making it harder to find and more valuable than others in the same series.',
  'glossary.term.mintage': 'Mintage',
  'glossary.definition.mintage': 'The total number of coins of a given type produced in a given year/mint.',
  'glossary.term.numismatics': 'Numismatics',
  'glossary.definition.numismatics': 'The study or collecting of coins, tokens, and paper currency.',
  'glossary.term.obverse': 'Obverse',
  'glossary.definition.obverse': 'The front (or "heads") side of a coin.',
  'glossary.term.patina': 'Patina',
  'glossary.definition.patina':
    "The natural color or sheen a coin's surface develops over time from age and handling.",
  'glossary.term.proof': 'Proof',
  'glossary.definition.proof':
    'A coin struck using a special high-precision process for collectors, with a mirror-like finish, rather than for general circulation.',
  'glossary.term.reverse': 'Reverse',
  'glossary.definition.reverse': 'The back (or "tails") side of a coin.',
  'glossary.term.uncirculated': 'Uncirculated',
  'glossary.definition.uncirculated':
    'A coin that shows no wear from having been used in everyday transactions.',
} satisfies Record<string, string>;

const en: Record<string, string> = enShape;
export default en;
export type MessageKey = keyof typeof enShape;
