// English dictionary, landing area: signed-out home page (`/`).
// Merged into the full dictionary by `./index.ts` (see that file for the typing).
const landing = {
  // hero
  'landing.eyebrow': 'For coin collectors',
  'landing.headline': 'See what you’re still missing.',
  'landing.headlineAltRules': 'Your checklist, your rules.',
  'landing.headlineAltShow': 'Take your want list to the show.',
  'landing.body':
    'Build a checklist on your own terms, mark the coins you own, and the gaps show themselves. Free, no grading service needed, and browsing needs no account.',
  'landing.bodyShort':
    'Build a checklist on your own terms, mark the coins you own, and the gaps show themselves. Free, no grading service needed.',
  'landing.ctaPrimary': 'Create a free account',
  'landing.ctaSecondary': 'Browse checklists',
  'landing.honest': 'Free. Built by a collector, for collectors.',

  // demo
  'landing.sampleBadge': 'Sample',
  'landing.sampleLabel': 'Sample checklist. Your own sets look like this.',
  'landing.sampleLabelShort': 'Your own sets look like this.',
  'landing.demoSubtitle': 'Curated checklist · United States · 1 Cent · first {shown} of {total} coins',
  'landing.demoSubtitleShort': 'Curated checklist · United States · {from}–{to}',
  'landing.progressLabel': 'Sample set completion',
  'landing.ownedOf': 'of',
  'landing.ownedWord': 'owned',
  'landing.showLabel': 'Show',
  'landing.filterAll': 'All',
  'landing.filterMissing': 'Missing',
  'landing.statusOwned': 'Owned',
  'landing.statusMissing': 'Missing',
  'landing.keyDate': 'Key date',
  'landing.groupSummary': '{owned} of {total}',
  'landing.autoNote': 'Showing only the gaps.',
  'landing.tapNote': 'Tap Missing to see only the gaps.',
  'landing.tryHint': 'Tap a coin to mark it owned or missing.',
  'landing.markOwned': 'Mark {coin} as owned (sample, not saved)',
  'landing.markMissing': 'Mark {coin} as missing (sample, not saved)',
  'landing.saveNote': 'Nothing here is saved. Create an account to keep your own.',
  'landing.demoFoot': 'Lincoln Wheat Cents, {from}–{to} shown.',
  'landing.seeFull': 'See the full checklist',
  'landing.plain': '(plain)',

  // want list
  'landing.wantTitle': 'Want list',
  'landing.wantCountOne': '1 coin',
  'landing.wantCountOther': '{count} coins',
  'landing.wantEmpty': 'Nothing missing. This set is complete.',
  'landing.wantKey': '★ = key date',
  'landing.wantPrint': 'Print',
  'landing.wantCsv': 'Download CSV',
  'landing.wantNote': 'The same list your own sets print and export.',

  // three points
  'landing.pointsHeading': 'How it works',
  'landing.p1Title': 'Your checklist, your rules',
  'landing.p1Body': 'Build a set from a catalog filter, pick coins one by one, or start from a curated checklist.',
  'landing.p1ChipFilter': 'Catalog filter',
  'landing.p1ChipHand': 'Pick by hand',
  'landing.p1ChipCurated': 'Curated checklist',
  'landing.p2Title': 'Owned once, counted everywhere',
  'landing.p2Body': 'Mark a coin once and every set that contains it updates.',
  'landing.p3Title': 'Take your want list to the show',
  'landing.p3Body': 'Print the missing list or download it as CSV.',

  // ways in
  'landing.waysHeading': 'Start browsing',
  'landing.wayCatalogTitle': 'Browse the catalog',
  'landing.wayCatalogBody': 'Every coin, by country, denomination and year.',
  'landing.wayCatalogCount': '{count} coins',
  'landing.wayChecklistsTitle': 'Curated checklists',
  'landing.wayChecklistsBody': 'Complete series lists, ready to start from.',
  'landing.wayChecklistsCountOne': '1 checklist',
  'landing.wayChecklistsCountOther': '{count} checklists',
  'landing.wayCollectorsTitle': 'Collectors’ sets',
  'landing.wayCollectorsBody': 'Sets other collectors have shared.',
  'landing.wayCollectorsCountNone': 'None shared yet. Yours could be the first.',
  'landing.wayCollectorsCountNoneShort': 'None yet',
  'landing.wayCollectorsCountOne': '1 set',
  'landing.wayCollectorsCountOther': '{count} sets',
  'landing.countsError': 'Couldn’t load the counts.',
  'landing.retry': 'Retry',
  'landing.loadingCount': 'Loading count',

  // coverage
  'landing.coverageHeading': 'What’s covered',
  'landing.coverageIntro': 'A small catalogue, checked by hand. It grows coin by coin.',
  'landing.coverageSubmit': 'Missing a coin? Submit it.',
  'landing.coverageLincolnTitle': 'Lincoln Wheat cents',
  'landing.coverageLincolnBody': 'Every date and mint mark, plus a key-dates checklist.',
  'landing.coverageLincolnMeta': '{coins} coins · {keyDates} key dates',
  'landing.coverageUkraineTitle': 'Ukrainian coins',
  'landing.coverageUkraineBody':
    'Circulation coins and circulating commemoratives, including We Are Strong. We Are Together.',
  'landing.coverageUkraineMeta': '{circulation} circulation · {commemoratives} commemoratives',

  // metadata
  'landing.metaDescription': 'Free checklists for coin collectors. Mark what you own and see what you’re still missing.',
  'landing.socialSub': 'Free checklists for coin collectors.',
} as const;

export default landing;
