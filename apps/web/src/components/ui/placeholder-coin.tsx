import { getDenominationNumeral } from '@coin-collector/shared';

export type PlaceholderCoinSize = 28 | 40 | 72 | 96 | 180 | 260 | 'fluid';
export type PlaceholderCoinTone = 'gold' | 'silver' | 'copper' | 'unknown';

export interface PlaceholderCoinProps {
  denomination: string;
  material: string | null;
  size?: PlaceholderCoinSize;
  missing?: boolean;
  imageUrl?: string | null;
  className?: string;
}

// First matching group wins, so plated and alloy names beat their base metal
// ("Brass-plated steel" is gold, "Copper-plated steel" is copper, "Aluminium bronze" is gold).
const TONE_GROUPS: Array<[PlaceholderCoinTone, string[]]> = [
  ['gold', ['brass-plated', 'brass', 'aluminium bronze', 'aluminum bronze', 'nordic gold']],
  ['copper', ['copper-plated']],
  ['silver', ['cupronickel', 'nickel', 'steel', 'aluminium', 'aluminum', 'silver']],
  ['copper', ['copper', 'bronze']],
];

/** The metal colour of a coin's placeholder, from its catalog material. */
export function getCoinTone(material: string | null): PlaceholderCoinTone {
  if (material === null) return 'unknown';
  const text = material.toLowerCase();
  for (const [tone, words] of TONE_GROUPS) {
    if (words.some((word) => text.includes(word))) return tone;
  }
  return 'unknown';
}

const UNIT_MAX_LENGTH = 9;

/** The unit word under the numeral: "10 Hryvnias" -> "Hryvnias", cut to 9 characters. */
export function getDenominationUnit(denomination: string): string {
  const numeral = getDenominationNumeral(denomination);
  const index = denomination.indexOf(numeral);
  const withoutNumeral =
    index === -1 ? denomination : denomination.slice(0, index) + denomination.slice(index + numeral.length);
  return withoutNumeral.replace(/\s+/g, ' ').trim().slice(0, UNIT_MAX_LENGTH);
}

const TONE_CLASSES: Record<PlaceholderCoinTone, string> = {
  gold: 'bg-gold-1 border-gold-2',
  silver: 'bg-silver-1 border-silver-2',
  copper: 'bg-copper-1 border-copper-2',
  unknown: 'bg-neutral-200 border-neutral-400',
};

const SIZE_CLASSES: Record<PlaceholderCoinSize, string> = {
  28: 'size-[28px] text-[28px]',
  40: 'size-[40px] text-[40px]',
  72: 'size-[72px] text-[72px]',
  96: 'size-[96px] text-[96px]',
  180: 'size-[180px] text-[180px]',
  260: 'size-[260px] text-[260px]',
  // The parent must be a @container (e.g. CoinCard's well).
  fluid: 'size-[54cqw] text-[54cqw]',
};

const DISC_CLASSES =
  'relative flex flex-none flex-col items-center justify-center rounded-full border-[0.045em] leading-none text-neutral-900 ' +
  'shadow-[inset_0_-0.035em_0_rgba(45,43,43,0.10),inset_0_0.03em_0_rgba(255,255,255,0.45)] ' +
  'motion-safe:transition motion-safe:duration-200';

/**
 * A drawn coin: a metal-toned disc with the denomination's numeral (and unit from 72px up),
 * or the coin's photo in the same circle when there is one. Decorative only.
 */
export function PlaceholderCoin({
  denomination,
  material,
  size = 96,
  missing = false,
  imageUrl = null,
  className = '',
}: PlaceholderCoinProps) {
  const tone = getCoinTone(material);
  const small = size === 28 || size === 40;
  const showUnit = !small;
  const showRing = size !== 28;

  const classes = [DISC_CLASSES, TONE_CLASSES[tone], SIZE_CLASSES[size], missing ? 'grayscale opacity-50' : '', className]
    .filter((part) => part !== '')
    .join(' ');

  return (
    <span
      data-testid="placeholder-coin"
      aria-hidden="true"
      data-tone={tone}
      data-size={String(size)}
      data-missing={missing ? 'true' : 'false'}
      className={classes}
    >
      {imageUrl ? (
        <img data-testid="placeholder-coin-image" src={imageUrl} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <>
          {showRing && (
            <span className="pointer-events-none absolute inset-[0.075em] rounded-full border border-neutral-900/20" />
          )}
          <span
            data-testid="placeholder-coin-numeral"
            className={`relative font-body font-semibold tracking-[-0.01em] ${small ? 'text-[0.4em]' : 'text-[0.34em]'}`}
          >
            {getDenominationNumeral(denomination)}
          </span>
          {showUnit && (
            <span
              data-testid="placeholder-coin-unit"
              className="relative mt-[0.14em] text-[max(9px,0.085em)] font-semibold uppercase tracking-[0.12em] text-neutral-900/80"
            >
              {getDenominationUnit(denomination)}
            </span>
          )}
        </>
      )}
    </span>
  );
}
