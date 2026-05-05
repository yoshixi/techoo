import { useEffect, useState } from 'react';

/** Current time, refreshed every `intervalMs` (log status line uses 30s like desktop). */
export function usePeriodicNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
