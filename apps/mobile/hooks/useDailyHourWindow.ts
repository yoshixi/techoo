import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'techo-mobile-daily-hour-window';
const DEFAULT_WAKE_HOUR = 6;
const DEFAULT_BED_HOUR = 23;

function normalizeWindow(wake: number, bed: number): { wakeHour: number; bedHour: number } {
  const wakeHour = Math.min(23, Math.max(0, Math.floor(wake)));
  const bedHour = Math.min(23, Math.max(0, Math.floor(bed)));
  if (wakeHour < bedHour) return { wakeHour, bedHour };
  return { wakeHour: DEFAULT_WAKE_HOUR, bedHour: DEFAULT_BED_HOUR };
}

function decodeStoredWindow(raw: string | null): { wakeHour: number; bedHour: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { wakeHour?: number; bedHour?: number };
    if (typeof parsed.wakeHour !== 'number' || typeof parsed.bedHour !== 'number') return null;
    return normalizeWindow(parsed.wakeHour, parsed.bedHour);
  } catch {
    return null;
  }
}

export function useDailyHourWindow(): {
  wakeHour: number;
  bedHour: number;
  setWakeHour: (nextWakeHour: number) => void;
  setBedHour: (nextBedHour: number) => void;
} {
  const [window, setWindow] = useState(() => ({
    wakeHour: DEFAULT_WAKE_HOUR,
    bedHour: DEFAULT_BED_HOUR,
  }));

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const decoded = decodeStoredWindow(raw);
      if (decoded) setWindow(decoded);
    });
  }, []);

  const persist = useCallback((nextWakeHour: number, nextBedHour: number) => {
    const next = normalizeWindow(nextWakeHour, nextBedHour);
    setWindow(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setWakeHour = useCallback(
    (nextWakeHour: number) => {
      persist(nextWakeHour, window.bedHour);
    },
    [persist, window.bedHour]
  );

  const setBedHour = useCallback(
    (nextBedHour: number) => {
      persist(window.wakeHour, nextBedHour);
    },
    [persist, window.wakeHour]
  );

  return {
    wakeHour: window.wakeHour,
    bedHour: window.bedHour,
    setWakeHour,
    setBedHour,
  };
}
