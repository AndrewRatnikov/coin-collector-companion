// English dictionary, browse-sets area: dashboard, canonicalSets, canonicalSetDetail, publicSets and publicSetDetail keys.
// Merged into the full dictionary by `./index.ts` (see that file for the typing).
const browseSets = {
  // dashboard
  'dashboard.title': 'My sets',
  'dashboard.setCountOne': '1 set',
  'dashboard.setCountMany': '{n} sets',
  'dashboard.browseLink': 'Browse checklists and collectors’ sets',
  'dashboard.browseLinkShort': 'Browse checklists',
  'dashboard.newSet': 'New set',
  'dashboard.summaryLabel': 'Summary',
  'dashboard.tileMissingLabel': 'coins still missing across your sets',
  'dashboard.tileMissingLink': 'See what to look for',
  'dashboard.tileClosestLabel': 'Closest to complete',
  'dashboard.tileClosestToGoOne': '1 coin to go',
  'dashboard.tileClosestToGoMany': '{n} coins to go',
  'dashboard.tileClosestComplete': 'Every set is complete',
  'dashboard.tileClosestNoCoins': 'Add coins to a set to see progress',
  'dashboard.tileCollectionLabel': 'coins in your collection',
  'dashboard.tileCollectionLink': 'Open Collection',
  'dashboard.yourSets': 'Your sets',
  'dashboard.sortLabel': 'Sort',
  'dashboard.sortClosest': 'Closest to complete',
  'dashboard.sortRecent': 'Recently updated',
  'dashboard.sortName': 'Name A–Z',
  'dashboard.sortMostMissing': 'Most missing',
  'dashboard.sourceCurated': 'From curated checklist',
  'dashboard.sourceCollector': 'From a collector’s set',
  'dashboard.suggestionEyebrow': 'A good next set',
  'dashboard.suggestionBody':
    '{total} coins. You already own {owned} of them, because ownership carries across sets.',
  'dashboard.suggestionCta': 'Start this set',
  'dashboard.emptyTitle': 'Start your first set',
  'dashboard.emptyBody':
    'A set is a checklist of coins. Tick the ones you own and we’ll show exactly what’s missing. The quickest start is a curated checklist.',
  'dashboard.emptyCuratedCta': 'Choose a curated checklist',
  'dashboard.popularChecklists': 'Popular checklists',
  'dashboard.popularCoinCount': '{n} coins',
  'dashboard.emptyPickYourself': 'Prefer to pick every coin yourself?',
  'dashboard.emptyStartBlank': 'Start an empty set',
  'dashboard.loadingLabel': 'Loading your sets',
  'dashboard.errorTitle': 'We couldn’t load your sets.',
  'dashboard.errorBody':
    'Your sets are safe. Check your connection and try again. If the server was asleep, it can take up to a minute to wake.',
  'dashboard.retry': 'Try again',

  // canonical sets
  'canonicalSets.title': 'Canonical sets',
  'canonicalSets.errorLoading': 'Something went wrong loading canonical sets. Please try again.',
  'canonicalSets.emptyMessage': 'No canonical sets yet.',

  // canonical set detail
  'canonicalSetDetail.errorLoading': 'Something went wrong loading this canonical set. Please try again.',
  'canonicalSetDetail.cloneCta': 'Clone into my sets',

  // public sets
  'publicSets.title': 'Public sets',
  'publicSets.errorLoading': 'Something went wrong loading public sets. Please try again.',
  'publicSets.emptyMessage': 'No public sets yet.',

  // public set detail
  'publicSetDetail.errorLoading': 'Something went wrong loading this set. Please try again.',
  'publicSetDetail.cloneCta': 'Clone into my sets',
} satisfies Record<string, string>;

export default browseSets;
