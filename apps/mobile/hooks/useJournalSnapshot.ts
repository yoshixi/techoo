import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorResponse } from '@/gen/api/schemas';
import { subscribeJournal } from '@/sync';

export function useJournalSnapshot<T>(
  enabled: boolean,
  read: () => Promise<T>,
  key: string
): {
  data: T | undefined;
  loading: boolean;
  error: ErrorResponse | undefined;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ErrorResponse | undefined>(undefined);
  const readRef = useRef(read);
  readRef.current = read;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setData(await readRef.current());
      setError(undefined);
    } catch (err) {
      setError({ error: err instanceof Error ? err.message : 'Could not read the journal' });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    void refresh();
    return subscribeJournal(() => {
      void refresh();
    });
  }, [enabled, key, refresh]);

  return { data, loading, error, refresh };
}
