// Small shared stroke icons. Each takes an optional className, written as the svg's last
// attribute; when it is undefined the markup carries no class at all.

export interface IconProps {
  /** Appended as the svg's last attribute; omitted from the markup when undefined. */
  className?: string;
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className={className}>
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m12 12 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
