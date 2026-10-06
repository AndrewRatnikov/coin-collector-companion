// Alias tables for the CSV import matcher. Plain data, written in natural spelling: the matcher
// runs every entry through normalizeText when it loads them, so nothing here is pre-normalised.

// Alias target (a catalog country) -> spellings users type for it.
export const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  USA: [
    'usa',
    'us',
    'u.s.',
    'u.s.a.',
    'united states',
    'united states of america',
    'the united states',
    'america',
    'сша',
    'estados unidos',
    'eeuu',
  ],
  Ukraine: ['ukraine', 'the ukraine', 'ukraina', 'ukrayina', 'україна', 'украина', 'ucrania'],
};

// Unit -> words that name it.
export const DENOMINATION_UNIT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  cent: ['cent', 'cents', 'c', 'ct', 'cts', 'penny', 'pennies'],
  hryvnia: [
    'hryvnia',
    'hryvnias',
    'hryvni',
    'hryven',
    'hryvnya',
    'hryvnyas',
    'hryvna',
    'hryvnas',
    'grivna',
    'grivnas',
    'grivnya',
    'hrivna',
    'гривня',
    'гривні',
    'гривень',
    'гривна',
    'гривны',
    'грн',
    'uah',
  ],
  kopiyka: [
    'kopiyka',
    'kopiyky',
    'kopiyok',
    'kopiika',
    'kopiiky',
    'kopiiok',
    'kopeck',
    'kopecks',
    'kopek',
    'kopeks',
    'kopeyka',
    'kopeyki',
    'kopeika',
    'kopeiki',
    'копійка',
    'копійки',
    'копійок',
    'копейка',
    'копейки',
    'копеек',
    'коп',
    'kop',
    'k',
  ],
};

// Leading number words -> amount.
export const DENOMINATION_NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  five: 5,
  ten: 10,
  'twenty five': 25,
  twentyfive: 25,
  fifty: 50,
};

// Words dropped from a denomination before the unit is looked up ("Wheat penny", "US cent").
export const DENOMINATION_IGNORED_WORDS: readonly string[] = [
  'wheat',
  'lincoln',
  'coin',
  'coins',
  'us',
  'usa',
  'american',
  'ukrainian',
  'ukraine',
];

// Mint mark cells that mean "no mint mark".
export const MINT_MARK_NONE_PLACEHOLDERS: readonly string[] = [
  '',
  'none',
  'no',
  'no mint',
  'no mint mark',
  'no mintmark',
  'nomint',
  'n/a',
  'na',
  'nil',
  'blank',
];

// Mint name -> mint mark letter(s).
export const MINT_MARK_NAMES: Readonly<Record<string, string>> = {
  philadelphia: 'P',
  denver: 'D',
  'san francisco': 'S',
  'west point': 'W',
  'new orleans': 'O',
  'carson city': 'CC',
};

// Variety cells that mean "no variety" (the plain coin).
export const VARIETY_NONE_PLACEHOLDERS: readonly string[] = [
  'none',
  'normal',
  'regular',
  'plain',
  'standard',
  'n/a',
  'na',
  'no variety',
];

// User spelling -> catalog variety.
export const VARIETY_ALIASES: Readonly<Record<string, string>> = {
  ddo: 'Doubled Die',
  'double die': 'Doubled Die',
  'doubled die obverse': 'Doubled Die',
  'double die obverse': 'Doubled Die',
  zinc: 'Steel',
  'steel cent': 'Steel',
  'v d b': 'VDB',
};
