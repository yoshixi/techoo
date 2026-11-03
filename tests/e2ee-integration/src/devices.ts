import { randomUUID } from 'node:crypto'
import {
  SqliteJournalStore,
  SyncEngine as DesktopEngine,
  SyncRequestError,
  createFetchTransport,
  type SyncTransport as DesktopTransport,
} from '../../../apps/electron/src/main/sync/index'
import { META } from '../../../apps/mobile/sync/format'
import {
  JournalService,
  SyncEngine as MobileEngine,
  SyncError,
  createNobleCrypto,
  createSqliteSyncStore,
  openNodeSqliteDatabase,
  type SyncTransport as MobileTransport,
} from '../../../apps/mobile/sync/node'
import type { SyncStore } from '../../../apps/mobile/sync/store'
import { Faults, createFaultingFetch } from './faults'
import { signUserJwt, type TestUser } from './jwt'

export const PASSPHRASE = 'correct horse battery staple'
export const REPLACEMENT_PASSPHRASE = 'replacement horse battery staple'

/** Mobile's id sorts after the desktop id, so an equal timestamp resolves to mobile. */
export const DESKTOP_DEVICE_ID = '11111111-1111-4111-8111-111111111111'
export const MOBILE_DEVICE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

export interface Clock {
  iso: string
}

export function clockAt(iso = '2026-11-03T08:00:00.000Z'): Clock {
  return { iso }
}

export function bump(clock: Clock, ms = 1000): void {
  clock.iso = new Date(Date.parse(clock.iso) + ms).toISOString()
}

export interface DesktopDevice {
  engine: DesktopEngine
  store: SqliteJournalStore
  faults: Faults
}

export interface MobileDevice {
  engine: MobileEngine
  journal: JournalService
  store: SyncStore
  faults: Faults
}

export interface DevicePair {
  desktop: DesktopDevice
  mobile: MobileDevice
}

const closers: Array<() => void> = []

export function closeDevices(): void {
  while (closers.length > 0) closers.pop()?.()
}

async function mapTransportError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof SyncRequestError) {
      if (error.status === 0) throw new SyncError('offline', error.message)
      throw new SyncError(error.code ?? 'http', error.message)
    }
    throw error
  }
}

function adaptMobileTransport(inner: DesktopTransport): MobileTransport {
  return {
    putVault: (body) => mapTransportError(() => inner.putVault(body)),
    getVault: () => mapTransportError(() => inner.getVault()),
    resetVault: (body) => mapTransportError(() => inner.resetVault(body)),
    async getHead() {
      try {
        return await mapTransportError(() => inner.getHead())
      } catch (error) {
        if (error instanceof SyncError && error.code === 'vault_not_found') return null
        throw error
      }
    },
    pushOps: (body) => mapTransportError(() => inner.pushOps(body)),
    pullOps: (query) => mapTransportError(() => inner.pullOps(query)),
  }
}

function desktopTransport(origin: string, user: TestUser, faults: Faults): DesktopTransport {
  return createFetchTransport({
    apiBaseUrl: `${origin}/api`,
    getToken: () => signUserJwt(user),
    fetchImpl: createFaultingFetch(faults),
  })
}

export function openDesktop(origin: string, user: TestUser, clock: Clock, faults = new Faults()): DesktopDevice {
  const store = SqliteJournalStore.open(':memory:')
  store.setMeta('device_id', DESKTOP_DEVICE_ID)
  const engine = new DesktopEngine(store, desktopTransport(origin, user, faults), {
    now: () => clock.iso,
    randomUUID,
  })
  closers.push(() => store.close())
  return { engine, store, faults }
}

export async function openMobile(
  origin: string,
  user: TestUser,
  clock: Clock,
  faults = new Faults(),
): Promise<MobileDevice> {
  const db = await openNodeSqliteDatabase(':memory:')
  const store = createSqliteSyncStore(db)
  await store.ensureSchema()
  await store.setMeta(META.deviceId, MOBILE_DEVICE_ID)
  const engine = new MobileEngine({
    store,
    transport: adaptMobileTransport(desktopTransport(origin, user, faults)),
    crypto: createNobleCrypto(),
    now: () => new Date(clock.iso),
  })
  return { engine, journal: new JournalService(store, engine), store, faults }
}

export async function openPair(origin: string, user: TestUser, clock: Clock): Promise<DevicePair> {
  const desktop = openDesktop(origin, user, clock)
  const mobile = await openMobile(origin, user, clock)
  return { desktop, mobile }
}

export interface PublicRecord {
  recordId: string
  kind: string
  deleted: boolean
  updatedAt: string
  fields: { [key: string]: unknown }
}

export function desktopRecords(engine: DesktopEngine): PublicRecord[] {
  return engine.listRecords(undefined, true).map((record) => ({
    recordId: record.recordId,
    kind: record.kind,
    deleted: record.deleted,
    updatedAt: record.updatedAt,
    fields: record.fields,
  }))
}

export async function mobileRecords(store: SyncStore): Promise<PublicRecord[]> {
  const rows = await store.listRecords()
  return rows.map((record) => ({
    recordId: record.recordId,
    kind: record.kind,
    deleted: record.deleted,
    updatedAt: record.updatedAt,
    fields: record.fields,
  }))
}

export function sortedRecords(records: PublicRecord[]): PublicRecord[] {
  return [...records].sort((left, right) => left.recordId.localeCompare(right.recordId))
}
