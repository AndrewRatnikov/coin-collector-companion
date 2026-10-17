// Loading placeholder block. Pulses with the --animate-skeleton token (1.4s) and slows to
// 2.4s per cycle under prefers-reduced-motion.
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="skeleton"
      aria-hidden="true"
      className={`animate-skeleton motion-reduce:[animation-duration:2.4s] rounded-[var(--radius-md)] bg-neutral-200 ${className}`.trimEnd()}
    />
  );
}
