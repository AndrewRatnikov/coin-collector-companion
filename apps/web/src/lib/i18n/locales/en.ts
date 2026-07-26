// English is the source of truth: every value here must stay byte-identical to
// the string that was hardcoded at each phrase's call site before i18n was
// introduced, so existing behavior (and any test asserting exact copy) never
// drifts. `MessageKey` below is derived from this object's literal keys, and
// `locales/es.ts` is compile-time checked against it (see that file).
const en = {
  // nav
  'nav.catalog': 'Catalog',
  'nav.canonicalSets': 'Canonical sets',
  'nav.publicSets': 'Public sets',
  'nav.dashboard': 'Dashboard',
  'nav.collection': 'Collection',
  'nav.logOut': 'Log out',
  'nav.logIn': 'Log in',

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

  // home
  'home.title': 'Coin Collector Companion',

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

  // collection
  'collection.title': 'My Collection',
  'collection.errorLoading': 'Something went wrong loading your collection. Please try again.',
  'collection.emptyMessage': "You don't own any coins yet.",

  // catalog
  'catalog.title': 'Catalog',
  'catalog.addCoinCta': "Can't find this coin? Add it",
  'catalog.errorLoading': 'Something went wrong loading the catalog. Please try again.',
  'catalog.emptyMessage': 'No coins found.',

  // coin detail
  'coinDetail.errorLoading': 'Something went wrong loading this coin. Please try again.',
  'coinDetail.pendingBadge': 'Pending review',
  'coinDetail.imageAttributionPrefix': 'Image:',
  'coinDetail.unknownSource': 'Unknown source',

  // submit coin form
  'submitCoinForm.submit': 'Submit coin',

  // submission confirmation
  'submissionConfirmation.addToSetButton': 'Add to this set',
  'submissionConfirmation.createSetSubmit': 'Create set and add coin',
  'submissionConfirmation.viewSetLink': 'View set',

  // set editor
  'setEditor.renameSubmit': 'Rename',
  'setEditor.deleteButton': 'Delete set',
  'setEditor.markNotOwned': 'Mark not owned',
  'setEditor.markOwned': 'Mark owned',
  'setEditor.removeButton': 'Remove',
  'setEditor.addCoinsHeading': 'Add coins',
  'setEditor.addButton': 'Add',
  'setEditor.errorLoading': 'Something went wrong loading this set. Please try again.',

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

  // public sets
  'publicSets.title': 'Public sets',
  'publicSets.errorLoading': 'Something went wrong loading public sets. Please try again.',
  'publicSets.emptyMessage': 'No public sets yet.',

  // public set detail
  'publicSetDetail.errorLoading': 'Something went wrong loading this set. Please try again.',
  'publicSetDetail.cloneCta': 'Clone into my sets',

  // footer
  'footer.attributionPrefix': 'Catalog data derived from',
  'footer.wikipediaLinkText': 'Wikipedia',
  'footer.attributionSuffix': ', used under CC BY-SA 4.0.',
} satisfies Record<string, string>;

export default en;
export type MessageKey = keyof typeof en;
