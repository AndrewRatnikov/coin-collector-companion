// English dictionary, want-list area: the combined want list across all sets (`/want-list`),
// plus the link to it from a set's missing page.
// Merged into the full dictionary by `./index.ts` (see that file for the typing).
const wantList = {
  // header
  'wantList.title': 'Want list',
  'wantList.subtitle': 'Across your {n} sets · {m} missing · {k} to upgrade',
  'wantList.printButton': 'Print',
  'wantList.downloadCsv': 'Download CSV',
  // sections
  'wantList.sectionMissing': 'Missing',
  'wantList.sectionUpgrade': 'Upgrade wanted',
  'wantList.upgradeNote': 'Owned, but below the minimum grade of the sets listed.',
  'wantList.nothingMissing': 'Nothing missing.',
  'wantList.nothingWanted': 'Nothing missing across your sets.',
  'wantList.plain': '(plain)',
  'wantList.keyLegend': '★ = key date',
  'wantList.whichSets': 'Which sets?',
  // loading, error, no sets
  'wantList.loadingLabel': 'Loading your want list',
  'wantList.errorTitle': 'We couldn’t load your want list.',
  'wantList.errorBody': 'Check your connection and try again.',
  'wantList.retry': 'Try again',
  'wantList.noSets': 'You don’t have any sets yet. Create one to start your want list.',
  'wantList.newSetLink': 'Create a set',
  // link from a set's missing page
  'wantList.allSetsLink': 'Want list for all your sets',
} as const;

export default wantList;
