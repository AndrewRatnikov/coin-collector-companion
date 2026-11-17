import { useEffect, useState } from 'react';

/** How long a public page may load before it shows the "waking the server" line. */
export const SERVER_WAKING_DELAY_MS = 3000;

/**
 * True once `isLoading` has stayed true for `delayMs`; false as soon as it turns false.
 * The timer restarts each time loading starts and is cleared on change and unmount.
 * Kept in its own module so page tests that mock the data-hook modules don't mock it away.
 */
export function useSlowLoading(isLoading: boolean, delayMs: number = SERVER_WAKING_DELAY_MS): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    setElapsed(false);
    if (!isLoading) return undefined;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [isLoading, delayMs]);

  return isLoading && elapsed;
}
