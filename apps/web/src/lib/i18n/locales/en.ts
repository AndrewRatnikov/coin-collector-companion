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
  'nav.settings': 'Settings',
  'nav.admin': 'Admin',
  'nav.importCollection': 'Import collection',

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
  'home.accountDeletedNotice': 'Your account has been deleted.',

  // login
  'login.title': 'Log in',
  'login.submit': 'Log in',
  'login.forgotPasswordLink': 'Forgot password?',
  'login.passwordResetNotice': 'Your password was reset. Log in with your new password.',

  // forgot / reset password
  'forgotPassword.title': 'Reset your password',
  'forgotPassword.intro': "Enter the email for your account and we'll send you a link to set a new password.",
  'forgotPassword.submit': 'Send reset link',
  'forgotPassword.sent': "If an account exists for that email, we've sent a link to reset your password. The link expires in 1 hour.",
  'forgotPassword.tooManyRequests': 'Too many reset requests. Please try again later.',
  'forgotPassword.backToLogin': 'Back to log in',
  'resetPassword.title': 'Choose a new password',
  'resetPassword.newPasswordLabel': 'New password',
  'resetPassword.confirmPasswordLabel': 'Confirm new password',
  'resetPassword.passwordsDoNotMatch': 'Passwords do not match',
  'resetPassword.submit': 'Set new password',
  'resetPassword.invalidLink': 'This reset link is invalid or has expired.',
  'resetPassword.requestNewLink': 'Request a new link',

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
  'collection.importLink': 'Import from CSV',

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
  'coinDetail.keyDateBadge': 'Key date',
  'coinDetail.diameter': 'Diameter',
  'coinDetail.weight': 'Weight',
  'coinDetail.thickness': 'Thickness',
  'coinDetail.material': 'Material',
  'coinDetail.mintage': 'Mintage',

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
  'setEditor.undo': 'Undo',
  'setEditor.noCoinsYet': 'No coins yet — add some below.',
  'setEditor.downloadMissing': 'Download missing (CSV)',
  'setEditor.printMissing': 'Print missing list',
  'setEditor.viewSwitchLabel': 'View',
  'setEditor.viewList': 'List',
  'setEditor.viewAlbum': 'Album',

  // set album
  'setAlbum.legendLabel': 'Legend',
  'setAlbum.legendOwned': 'Owned',
  'setAlbum.legendMissing': 'Missing',
  'setAlbum.legendKeyDate': 'Key date',
  'setAlbum.legendBlank': 'Not in this set',
  'setAlbum.yearHeader': 'Year',
  'setAlbum.noMintMark': 'No mint mark',
  'setAlbum.ownedOfTotal': '{owned} of {total} owned',
  'setAlbum.columnTotals': 'Owned',
  'setAlbum.keyDate': 'key date',
  'setAlbum.blankCell': 'No coin in this set',
  'setAlbum.viewInCatalog': 'View in catalog',
  'setAlbum.empty': 'This set has no coins yet.',
  'setAlbum.emptyOwnerHint': 'Use "Add coins" to start filling it.',
  'setAlbum.toggleError': "Couldn't update this coin. Please try again.",

  // missing list
  'missingList.heading': 'Missing coins',
  'missingList.dateLabel': 'Date',
  'missingList.printButton': 'Print',
  'missingList.colKeyDate': 'Key date',
  'missingList.keyDateBadge': '★ Key date',
  'missingList.empty': 'You own every coin in this set. Nothing to print.',

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
  'mySubmissions.rejectionReasonLabel': 'Reason:',

  // admin review
  'admin.submissionsTitle': 'Review submissions',
  'admin.errorLoading': 'Something went wrong loading submissions. Please try again.',
  'admin.forbidden': "You don't have permission to view this page.",
  'admin.emptyMessage': 'No submissions are waiting for review.',
  'admin.submittedBy': 'Submitted by',
  'admin.submitterUnknown': 'Unknown submitter',
  'admin.duplicateWarning': 'Possible duplicate of an approved coin:',
  'admin.approve': 'Approve',
  'admin.reject': 'Reject',
  'admin.edit': 'Edit',
  'admin.rejectReasonLabel': 'Reason (optional)',
  'admin.rejectConfirm': 'Confirm rejection',
  'admin.saveAndApprove': 'Save and approve',
  'admin.errorConflict': 'This submission was already reviewed, or another coin already has the same details.',

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

  // settings
  'settings.title': 'Settings',
  'settings.emailLabel': 'Email',
  'settings.memberSinceLabel': 'Member since',
  'settings.changePasswordTitle': 'Change password',
  'settings.currentPasswordLabel': 'Current password',
  'settings.newPasswordLabel': 'New password',
  'settings.confirmNewPasswordLabel': 'Confirm new password',
  'settings.passwordsDoNotMatch': 'Passwords do not match',
  'settings.changePasswordSubmit': 'Change password',
  'settings.changePasswordSuccess': 'Password changed successfully.',
  'settings.changePasswordError': 'Something went wrong changing your password. Please try again.',
  'settings.accountTabLabel': 'Account',
  'settings.feedbackTabLabel': 'Feedback',
  'settings.feedbackTitle': 'Send feedback',
  'settings.feedbackTextLabel': 'Your feedback',
  'settings.feedbackSubmit': 'Submit feedback',
  'settings.feedbackSuccess': 'Thanks for your feedback!',
  'settings.feedbackError': 'Something went wrong sending your feedback. Please try again.',
  'settings.feedbackValidationEmpty': 'Please enter some feedback before submitting.',
  'settings.feedbackValidationTooLong': 'Feedback must be 2000 characters or fewer.',
  'settings.deleteAccountTitle': 'Delete account',
  'settings.deleteAccountIntro': 'Permanently delete your account and personal data.',
  'settings.deleteAccountOpen': 'Delete account',
  'settings.deleteAccountWhatIsDeleted': 'This permanently deletes your sets, your collection and your feedback.',
  'settings.deleteAccountWhatStays': 'Coins you submitted to the catalog stay in the catalog, no longer linked to you.',
  'settings.deleteAccountPasswordLabel': 'Current password',
  'settings.deleteAccountAcknowledge': 'I understand this cannot be undone',
  'settings.deleteAccountSubmit': 'Permanently delete my account',
  'settings.deleteAccountCancel': 'Cancel',
  'settings.deleteAccountWrongPassword': 'Password is incorrect.',
  'settings.deleteAccountError': 'Something went wrong deleting your account. Please try again.',

  // collection import
  'import.title': 'Import your collection',
  'import.intro': 'Upload a CSV of the coins you own. Nothing is saved until you confirm.',
  'import.fileLabel': 'CSV file',
  'import.limitsHint': 'CSV only, up to 1 MB and 2,000 rows.',
  'import.previewButton': 'Preview',
  'import.previewing': 'Reading your file…',
  'import.mappingTitle': 'Columns',
  'import.mappingHint': 'Map Year (or Coin), Country and Denomination to continue.',
  'import.mappingNotMapped': 'Not mapped',
  'import.mappingApply': 'Apply mapping',
  'import.field.year': 'Year',
  'import.field.country': 'Country',
  'import.field.denomination': 'Denomination',
  'import.field.mintMark': 'Mint mark',
  'import.field.variety': 'Variety',
  'import.field.combined': 'Coin (e.g. 1909-S VDB)',
  'import.summary.matched': 'Matched',
  'import.summary.alreadyOwned': 'Already owned',
  'import.summary.duplicate': 'Duplicate in file',
  'import.summary.ambiguous': 'Ambiguous',
  'import.summary.unmatched': 'Unmatched',
  'import.summary.invalid': 'Invalid',
  'import.summary.toImport': 'To be imported',
  'import.status.matched': 'Matched',
  'import.status.ambiguous': 'Ambiguous',
  'import.status.unmatched': 'Unmatched',
  'import.status.invalid': 'Invalid',
  'import.status.skipped': 'Skipped',
  'import.status.resolved': 'Resolved',
  'import.flag.alreadyOwned': 'Already owned',
  'import.flag.duplicate': 'Duplicate in file',
  'import.reason.year_missing': 'Year is missing',
  'import.reason.year_invalid': 'Year is not a valid year',
  'import.reason.country_missing': 'Country is missing',
  'import.reason.denomination_missing': 'Denomination is missing',
  'import.reason.country_not_recognised': 'Country not recognised',
  'import.reason.denomination_not_recognised': 'Denomination not recognised',
  'import.reason.mint_mark_not_recognised': 'Mint mark not recognised',
  'import.reason.no_such_coin': 'No such coin in the catalog',
  'import.reason.multiple_matches': 'Several coins match; pick one',
  'import.reason.variety_not_recognised': 'Variety not recognised; pick one',
  'import.row.skip': 'Skip',
  'import.row.reset': 'Undo',
  'import.row.chooseCandidate': 'Choose a coin…',
  'import.row.search': 'Find in catalog',
  'import.search.empty': 'No coins found.',
  'import.search.pick': 'Select',
  'import.confirm': 'Confirm import',
  'import.startOver': 'Start over',
  'import.result.title': 'Import complete',
  'import.result.created': 'Added to your collection',
  'import.result.alreadyOwned': 'Already owned',
  'import.result.skipped': 'Rows skipped',
  'import.result.viewCollection': 'View your collection',
  'import.result.importAnother': 'Import another file',
  'import.error.fileRequired': 'Choose a CSV file first.',
  'import.error.fileTooLarge': 'The file is larger than 1 MB.',
  'import.error.tooManyRows': 'The file has more than 2,000 rows.',
  'import.error.notUtf8': 'The file is not UTF-8 text. Save it as "CSV UTF-8" and try again.',
  'import.error.notCsv': "This file doesn't look like a CSV file.",
  'import.error.empty': 'The file is empty.',
  'import.error.noDataRows': 'The file has a header row but no data rows.',
  'import.error.invalidMapping': 'The column mapping is not valid.',
  'import.error.unknownCoin': 'Some selected coins are no longer in the catalog. Preview the file again.',
  'import.error.rateLimited': 'Too many attempts. Please wait a minute and try again.',
} satisfies Record<string, string>;

const en: Record<string, string> = enShape;
export default en;
export type MessageKey = keyof typeof enShape;
