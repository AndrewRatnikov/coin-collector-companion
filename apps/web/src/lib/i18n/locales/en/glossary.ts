// English dictionary, glossary area: glossary keys.
// Merged into the full dictionary by `./index.ts` (see that file for the typing).
const glossary = {
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

export default glossary;
