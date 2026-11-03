import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { openExpoJournalDatabase } from '@/lib/journal/expoDb';
import { createApiTransport } from '@/lib/journal/transport';
import {
  createNobleCrypto,
  createSqliteSyncStore,
  JournalService,
  SyncEngine,
  SyncError,
  type SyncResult,
} from '@/sync';
import { META, JOURNAL_SOURCE_LOCAL } from '@/sync/format';

export type JournalMode = 'remote' | 'local';

type JournalContextValue = {
  mode: JournalMode;
  status: SyncResult | null;
  createVault: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  resetVault: (passphrase: string) => Promise<void>;
  replaceWithRemoteVault: (passphrase: string) => Promise<void>;
  syncNow: () => Promise<void>;
  probeVault: () => Promise<'none' | 'present' | 'offline'>;
};

const JournalContext = createContext<JournalContextValue | null>(null);

let activeService: JournalService | null = null;
let activeMode: JournalMode = 'remote';

export function getJournalMode(): JournalMode {
  return activeMode;
}

export function getJournalService(): JournalService {
  if (!activeService) throw new Error('The on-device journal is not open');
  return activeService;
}

export function useJournalMode(): JournalMode {
  return useContext(JournalContext)?.mode ?? 'remote';
}

export function useEncryptedSync(): JournalContextValue {
  const value = useContext(JournalContext);
  if (!value) {
    throw new Error('Encrypted sync is only available inside JournalProvider');
  }
  return value;
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<JournalMode>('remote');
  const [status, setStatus] = useState<SyncResult | null>(null);
  const serviceRef = useRef<JournalService | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publish = useCallback((next: JournalMode, service: JournalService | null) => {
    activeMode = next;
    activeService = service;
    setMode(next);
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const service = serviceRef.current;
      if (!service || activeMode !== 'local') return;
      void service.sync().then(setStatus);
    }, 400);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      serviceRef.current?.engine.lock();
      serviceRef.current = null;
      publish('remote', null);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void (async () => {
      const db = await openExpoJournalDatabase();
      const store = createSqliteSyncStore(db);
      await store.ensureSchema();
      const engine = new SyncEngine({
        store,
        transport: createApiTransport(),
        crypto: createNobleCrypto(),
      });
      const service = new JournalService(store, engine, () => scheduleSync());
      if (cancelled) return;
      serviceRef.current = service;
      const source = await store.getMeta(META.journalSource);
      const next = source === JOURNAL_SOURCE_LOCAL ? 'local' : 'remote';
      publish(next, service);
      setReady(true);
      if (next === 'local') {
        const result = await service.sync();
        if (!cancelled) setStatus(result);
      }
    })().catch(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, publish, scheduleSync]);

  useEffect(() => {
    if (!ready || mode !== 'local') return;
    const sync = () => {
      const service = serviceRef.current;
      if (!service) return;
      void service.sync().then(setStatus);
    };
    const timer = setInterval(sync, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, mode]);

  const run = useCallback(
    async (fn: (service: JournalService) => Promise<SyncResult | void>, becomeLocal: boolean) => {
      const service = serviceRef.current;
      if (!service) throw new SyncError('not_ready', 'Journal is still opening');
      const result = await fn(service);
      if (becomeLocal) publish('local', service);
      if (result) setStatus(result);
      else if (service.engine.lastResult) setStatus(service.engine.lastResult);
    },
    [publish]
  );

  const value = useMemo<JournalContextValue>(
    () => ({
      mode,
      status,
      async createVault(passphrase) {
        await run(async (service) => {
          await service.engine.createVault(passphrase);
          return service.engine.lastResult ?? undefined;
        }, true);
      },
      async unlock(passphrase) {
        await run(async (service) => {
          await service.engine.unlock(passphrase);
          return service.engine.lastResult ?? undefined;
        }, true);
      },
      lock() {
        serviceRef.current?.engine.lock();
        setStatus((current) =>
          current ? { ...current, status: 'locked' } : { status: 'locked', pending: 0, cursor: 0 }
        );
      },
      async resetVault(passphrase) {
        await run(async (service) => {
          await service.engine.resetVault(passphrase);
          return service.engine.lastResult ?? undefined;
        }, true);
      },
      async replaceWithRemoteVault(passphrase) {
        await run(async (service) => {
          await service.engine.replaceWithRemoteVault(passphrase);
          return service.engine.lastResult ?? undefined;
        }, true);
      },
      async syncNow() {
        await run(async (service) => service.sync(), false);
      },
      async probeVault() {
        try {
          const vault = await createApiTransport().getVault();
          return vault ? 'present' : 'none';
        } catch (err) {
          if (err instanceof SyncError && err.code === 'offline') return 'offline';
          throw err;
        }
      },
    }),
    [mode, run, status]
  );

  if (isAuthenticated && !ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}
