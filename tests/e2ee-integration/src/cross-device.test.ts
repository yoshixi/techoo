import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SyncChainError, SyncVaultResetError } from '../../../apps/electron/src/main/sync/index'
import { META } from '../../../apps/mobile/sync/format'
import { Faults, type PullFault } from './faults'
import {
  PASSPHRASE,
  REPLACEMENT_PASSPHRASE,
  bump,
  clockAt,
  closeDevices,
  desktopRecords,
  mobileRecords,
  openDesktop,
  openMobile,
  openPair,
  sortedRecords,
  type Clock,
  type DesktopDevice,
  type MobileDevice,
  type PublicRecord,
} from './devices'
import { signUserJwt, testUser, type TestUser } from './jwt'
import { startSyncWorker, type SyncWorker } from './worker'

let worker: SyncWorker

beforeAll(async () => {
  worker = await startSyncWorker()
}, 180_000)

afterAll(async () => {
  await worker?.stop()
})

afterEach(() => {
  closeDevices()
})

async function api(user: TestUser, path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${await signUserJwt(user)}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${worker.origin}${path}`, { ...init, headers })
  const text = await response.text()
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null }
}

async function settled(desktop: DesktopDevice, mobile: MobileDevice): Promise<void> {
  await desktop.engine.sync()
  const result = await mobile.journal.sync()
  expect(result.status, result.message).toBe('ok')
  await desktop.engine.sync()
  const again = await mobile.journal.sync()
  expect(again.status, again.message).toBe('ok')
}

async function journals(desktop: DesktopDevice, mobile: MobileDevice): Promise<{ desktop: PublicRecord[]; mobile: PublicRecord[] }> {
  return {
    desktop: sortedRecords(desktopRecords(desktop.engine)),
    mobile: sortedRecords(await mobileRecords(mobile.store)),
  }
}

async function expectConverged(desktop: DesktopDevice, mobile: MobileDevice): Promise<PublicRecord[]> {
  await settled(desktop, mobile)
  const rows = await journals(desktop, mobile)
  expect(rows.desktop).toEqual(rows.mobile)
  expect(rows.desktop.every((record) => record.deleted || Object.keys(record.fields).length > 0)).toBe(true)
  return rows.desktop
}

function titles(records: PublicRecord[]): string[] {
  return records.filter((record) => !record.deleted).map((record) => String(record.fields.title)).sort()
}

async function freshReader(
  user: TestUser,
  clock: Clock,
  kind: 'desktop' | 'mobile',
  fault: PullFault | null,
): Promise<{ desktop?: DesktopDevice; mobile?: MobileDevice }> {
  const faults = new Faults()
  faults.pull = fault
  if (kind === 'desktop') return { desktop: openDesktop(worker.origin, user, clock, faults) }
  return { mobile: await openMobile(worker.origin, user, clock, faults) }
}

describe('cross-device encrypted sync', () => {
  it('creates a vault on desktop and joins it on mobile', async () => {
    const clock = clockAt()
    const user = testUser('desktop-vault')
    const { desktop, mobile } = await openPair(worker.origin, user, clock)

    await desktop.engine.setup(PASSPHRASE)
    bump(clock)
    desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'from-desktop', body: 'desk' } })
    await desktop.engine.sync()

    await mobile.engine.unlock(PASSPHRASE)
    expect(titles(await mobileRecords(mobile.store))).toEqual(['from-desktop'])

    bump(clock)
    await mobile.journal.createTodo({ title: 'from-mobile' })
    await expectConverged(desktop, mobile)
    expect(titles(desktopRecords(desktop.engine))).toEqual(['from-desktop', 'from-mobile'])

    bump(clock)
    const note = desktop.engine.listRecords('note').find((record) => record.fields.title === 'from-desktop')
    expect(note).toBeDefined()
    if (!note) return
    desktop.engine.upsertRecord({
      recordId: note.recordId,
      kind: 'note',
      fields: { title: 'edited-on-desktop', body: 'desk' },
    })
    await expectConverged(desktop, mobile)

    bump(clock)
    const todo = (await mobile.journal.queryTodos())[0]
    expect(todo).toBeDefined()
    if (!todo) return
    await mobile.journal.updateTodo(todo.id, { title: 'edited-on-mobile' })
    const rows = await expectConverged(desktop, mobile)
    expect(titles(rows)).toEqual(['edited-on-desktop', 'edited-on-mobile'])
  })

  it('creates a vault on mobile and joins it on desktop', async () => {
    const clock = clockAt()
    const user = testUser('mobile-vault')
    const { desktop, mobile } = await openPair(worker.origin, user, clock)

    await mobile.engine.createVault(PASSPHRASE)
    bump(clock)
    await mobile.journal.createNote({ title: 'from-mobile', body: 'phone' })
    await mobile.journal.sync()

    expect(await desktop.engine.discover()).toBe('ready')
    await desktop.engine.unlock(PASSPHRASE)
    await desktop.engine.sync()
    expect(titles(desktopRecords(desktop.engine))).toEqual(['from-mobile'])

    bump(clock)
    desktop.engine.upsertRecord({ kind: 'todo', fields: { title: 'from-desktop', done: false, isAllDay: false } })
    await expectConverged(desktop, mobile)

    bump(clock)
    const note = (await mobile.journal.queryNotes())[0]
    expect(note).toBeDefined()
    if (!note) return
    await mobile.journal.updateNote(note.id, 'edited-on-mobile', 'phone')
    await expectConverged(desktop, mobile)

    bump(clock)
    const todo = desktop.engine.listRecords('todo')[0]
    expect(todo).toBeDefined()
    if (!todo) return
    desktop.engine.upsertRecord({
      recordId: todo.recordId,
      kind: 'todo',
      fields: { title: 'edited-on-desktop' },
    })
    const rows = await expectConverged(desktop, mobile)
    expect(titles(rows)).toEqual(['edited-on-desktop', 'edited-on-mobile'])
  })

  it('converges offline edits to the later updatedAt', async () => {
    const clock = clockAt()
    const { desktop, mobile } = await openPair(worker.origin, testUser('later-time'), clock)
    await desktop.engine.setup(PASSPHRASE)
    const note = desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'shared', body: 'start' } })
    await desktop.engine.sync()
    await mobile.engine.unlock(PASSPHRASE)

    desktop.faults.offline = true
    mobile.faults.offline = true
    bump(clock)
    desktop.engine.upsertRecord({ recordId: note.recordId, kind: 'note', fields: { title: 'from-desktop', body: 'start' } })
    bump(clock)
    const local = (await mobile.journal.queryNotes())[0]
    expect(local).toBeDefined()
    if (!local) return
    await mobile.journal.updateNote(local.id, 'from-mobile', 'start')
    expect((await desktop.engine.sync()).offline).toBe(true)
    expect((await mobile.journal.sync()).status).toBe('offline')

    desktop.faults.offline = false
    mobile.faults.offline = false
    const rows = await expectConverged(desktop, mobile)
    expect(titles(rows)).toEqual(['from-mobile'])
    expect(rows.filter((record) => !record.deleted).every((record) => record.updatedAt === clock.iso)).toBe(true)
  })

  it('converges equal timestamps to the greater device id', async () => {
    const clock = clockAt()
    const { desktop, mobile } = await openPair(worker.origin, testUser('device-id'), clock)
    await desktop.engine.setup(PASSPHRASE)
    const note = desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'shared', body: 'start' } })
    await desktop.engine.sync()
    await mobile.engine.unlock(PASSPHRASE)

    desktop.faults.offline = true
    mobile.faults.offline = true
    bump(clock)
    desktop.engine.upsertRecord({ recordId: note.recordId, kind: 'note', fields: { title: 'from-desktop', body: 'start' } })
    const local = (await mobile.journal.queryNotes())[0]
    expect(local).toBeDefined()
    if (!local) return
    await mobile.journal.updateNote(local.id, 'from-mobile', 'start')
    expect(desktop.engine.listRecords('note')[0]?.updatedAt).toBe(clock.iso)
    expect((await mobile.store.getRecord(note.recordId))?.updatedAt).toBe(clock.iso)

    desktop.faults.offline = false
    mobile.faults.offline = false
    const rows = await expectConverged(desktop, mobile)
    expect(titles(rows)).toEqual(['from-mobile'])
  })

  it('converges an equal timestamp from one device to the greater seq', async () => {
    const clock = clockAt()
    const { desktop, mobile } = await openPair(worker.origin, testUser('seq'), clock)
    await desktop.engine.setup(PASSPHRASE)
    const note = desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'seq-1', body: 'start' } })
    await desktop.engine.sync()
    await mobile.engine.unlock(PASSPHRASE)
    expect(titles(await mobileRecords(mobile.store))).toEqual(['seq-1'])

    desktop.engine.upsertRecord({ recordId: note.recordId, kind: 'note', fields: { title: 'seq-2', body: 'start' } })
    expect(desktop.engine.listRecords('note')[0]?.updatedAt).toBe(note.updatedAt)
    const rows = await expectConverged(desktop, mobile)
    expect(titles(rows)).toEqual(['seq-2'])
    expect(rows[0]?.updatedAt).toBe(note.updatedAt)
  })

  it('propagates a tombstone and keeps it ahead of an older offline edit', async () => {
    const clock = clockAt()
    const { desktop, mobile } = await openPair(worker.origin, testUser('tombstone'), clock)
    await desktop.engine.setup(PASSPHRASE)
    const note = desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'doomed', body: 'start' } })
    await desktop.engine.sync()
    await mobile.engine.unlock(PASSPHRASE)

    desktop.faults.offline = true
    mobile.faults.offline = true
    bump(clock)
    desktop.engine.upsertRecord({ recordId: note.recordId, kind: 'note', fields: { title: 'older-edit', body: 'start' } })
    const olderAt = clock.iso
    bump(clock)
    const local = (await mobile.journal.queryNotes())[0]
    expect(local).toBeDefined()
    if (!local) return
    await mobile.journal.deleteNote(local.id)

    desktop.faults.offline = false
    mobile.faults.offline = false
    const pushedDelete = await mobile.journal.sync()
    expect(pushedDelete.status, pushedDelete.message).toBe('ok')
    await desktop.engine.sync()
    await mobile.journal.sync()

    const rows = await journals(desktop, mobile)
    expect(rows.desktop).toEqual(rows.mobile)
    expect(rows.desktop).toEqual([
      expect.objectContaining({
        recordId: note.recordId,
        deleted: true,
        fields: {},
        updatedAt: clock.iso,
      }),
    ])
    expect(clock.iso > olderAt).toBe(true)
    expect(desktop.engine.listRecords('note')).toEqual([])
    expect(await mobile.journal.queryNotes()).toEqual([])
  })

  it('re-pushes the same clientOpId without advancing the log', async () => {
    const clock = clockAt()
    const user = testUser('idempotent')
    const { desktop, mobile } = await openPair(worker.origin, user, clock)
    await desktop.engine.setup(PASSPHRASE)
    desktop.faults.dropPushAcks = 1
    desktop.faults.pull = 'pretend-caught-up'
    desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'once', body: 'desk' } })
    expect((await desktop.engine.sync()).offline).toBe(true)
    expect(desktop.faults.pushes).toHaveLength(1)

    const head = await api(user, '/api/v1/sync')
    expect(head.status).toBe(200)
    expect(head.body).toMatchObject({ headSeq: 1 })

    desktop.faults.dropPushAcks = 0
    expect((await desktop.engine.sync()).offline).toBe(false)
    expect(desktop.faults.pushes.length).toBeGreaterThanOrEqual(2)
    expect(desktop.faults.pushes.every((batch) => JSON.stringify(batch) === JSON.stringify(desktop.faults.pushes[0]))).toBe(
      true,
    )
    const replayed = await api(user, '/api/v1/sync')
    expect(replayed.body).toEqual(head.body)

    desktop.faults.pull = null
    expect((await desktop.engine.sync()).offline).toBe(false)
    await mobile.engine.unlock(PASSPHRASE)
    expect(titles(await mobileRecords(mobile.store))).toEqual(['once'])

    mobile.faults.dropPushAcks = 1
    mobile.faults.pull = 'pretend-caught-up'
    mobile.faults.caughtUpSeq = Number((await mobile.store.getMeta(META.cursorSeq)) ?? '0')
    mobile.faults.caughtUpHash = (await mobile.store.getMeta(META.cursorHash)) ?? '0'.repeat(64)
    bump(clock)
    await mobile.journal.updateNote((await mobile.journal.queryNotes())[0]!.id, 'twice', 'desk')
    expect((await mobile.journal.sync()).status).toBe('offline')
    const afterFirst = await api(user, '/api/v1/sync')
    expect(afterFirst.body).toMatchObject({ headSeq: 2 })
    const mobilePushes = mobile.faults.pushes.length
    expect(mobilePushes).toBeGreaterThan(0)

    mobile.faults.dropPushAcks = 0
    expect((await mobile.journal.sync()).status).toBe('ok')
    expect(mobile.faults.pushes.at(-1)).toEqual(mobile.faults.pushes[mobilePushes - 1])
    const afterRetry = await api(user, '/api/v1/sync')
    expect(afterRetry.body).toEqual(afterFirst.body)

    mobile.faults.pull = null
    expect((await mobile.journal.sync()).status).toBe('ok')
    await desktop.engine.sync()
    expect(titles(desktopRecords(desktop.engine))).toEqual(['twice'])
  })

  it('pulls a partial page until both devices have the full log', async () => {
    const clock = clockAt()
    const user = testUser('partial')
    const writer = openDesktop(worker.origin, user, clock)
    await writer.engine.setup(PASSPHRASE)
    for (const title of ['one', 'two', 'three']) {
      bump(clock)
      writer.engine.upsertRecord({ kind: 'note', fields: { title, body: 'page' } })
    }
    await writer.engine.sync()

    const readerFaults = new Faults()
    readerFaults.pull = 'limit-1'
    const mobile = await openMobile(worker.origin, user, clock, readerFaults)
    await mobile.engine.unlock(PASSPHRASE)
    expect(readerFaults.pullCount).toBeGreaterThanOrEqual(3)
    expect(titles(await mobileRecords(mobile.store))).toEqual(['one', 'three', 'two'])

    const desktopFaults = new Faults()
    desktopFaults.pull = 'limit-1'
    const desktop = openDesktop(worker.origin, user, clock, desktopFaults)
    await desktop.engine.discover()
    await desktop.engine.unlock(PASSPHRASE)
    await desktop.engine.sync()
    expect(desktopFaults.pullCount).toBeGreaterThanOrEqual(3)
    expect(sortedRecords(desktopRecords(desktop.engine))).toEqual(sortedRecords(await mobileRecords(mobile.store)))
  })

  it('rejects a gapped pull and accepts an out-of-order page only when the chain still verifies', async () => {
    const clock = clockAt()
    const user = testUser('order')
    const writer = openDesktop(worker.origin, user, clock)
    await writer.engine.setup(PASSPHRASE)
    bump(clock)
    writer.engine.upsertRecord({ kind: 'note', fields: { title: 'first', body: 'page' } })
    bump(clock)
    writer.engine.upsertRecord({ kind: 'note', fields: { title: 'second', body: 'page' } })
    await writer.engine.sync()

    const gapped = await freshReader(user, clock, 'desktop', 'drop-first')
    await gapped.desktop?.engine.discover()
    await gapped.desktop?.engine.unlock(PASSPHRASE)
    await expect(gapped.desktop?.engine.sync()).rejects.toBeInstanceOf(SyncChainError)
    expect(gapped.desktop?.engine.status().cursor).toBe(0)
    expect(gapped.desktop?.engine.listRecords(undefined, true)).toEqual([])

    const gappedMobile = await freshReader(user, clock, 'mobile', 'drop-first')
    await gappedMobile.mobile?.engine.unlock(PASSPHRASE)
    expect(gappedMobile.mobile?.engine.lastResult?.status).toBe('error')
    expect(await gappedMobile.mobile?.store.getMeta(META.cursorSeq)).toBe('0')
    expect(await gappedMobile.mobile?.store.listRecords()).toEqual([])

    // Desktop requires the wire order to already be seq order. Mobile sorts the page, then verifies.
    const reversed = await freshReader(user, clock, 'desktop', 'reverse')
    await reversed.desktop?.engine.discover()
    await reversed.desktop?.engine.unlock(PASSPHRASE)
    await expect(reversed.desktop?.engine.sync()).rejects.toBeInstanceOf(SyncChainError)
    expect(reversed.desktop?.engine.status().cursor).toBe(0)
    expect(reversed.desktop?.engine.listRecords(undefined, true)).toEqual([])
    if (reversed.desktop) reversed.desktop.faults.pull = null
    await reversed.desktop?.engine.sync()
    expect(titles(desktopRecords(reversed.desktop!.engine))).toEqual(['first', 'second'])

    const reversedMobile = await freshReader(user, clock, 'mobile', 'reverse')
    await reversedMobile.mobile?.engine.unlock(PASSPHRASE)
    expect(reversedMobile.mobile?.engine.lastResult?.status).toBe('ok')
    expect(titles(await mobileRecords(reversedMobile.mobile!.store))).toEqual(['first', 'second'])
    expect(sortedRecords(desktopRecords(reversed.desktop!.engine))).toEqual(
      sortedRecords(await mobileRecords(reversedMobile.mobile!.store)),
    )
  })

  it('rejects an altered ciphertext and a broken chain without applying them', async () => {
    const clock = clockAt()
    const user = testUser('tamper')
    const writer = openDesktop(worker.origin, user, clock)
    await writer.engine.setup(PASSPHRASE)
    bump(clock)
    writer.engine.upsertRecord({ kind: 'note', fields: { title: 'secret', body: 'sealed' } })
    await writer.engine.sync()

    const desktopCipher = await freshReader(user, clock, 'desktop', 'tamper-ciphertext')
    await desktopCipher.desktop?.engine.discover()
    await desktopCipher.desktop?.engine.unlock(PASSPHRASE)
    await expect(desktopCipher.desktop?.engine.sync()).rejects.toBeInstanceOf(SyncChainError)
    expect(desktopCipher.desktop?.engine.status().cursor).toBe(0)
    expect(desktopCipher.desktop?.engine.listRecords(undefined, true)).toEqual([])

    const mobileCipher = await freshReader(user, clock, 'mobile', 'tamper-ciphertext')
    await mobileCipher.mobile?.engine.unlock(PASSPHRASE)
    expect(mobileCipher.mobile?.engine.lastResult?.status).toBe('error')
    expect(await mobileCipher.mobile?.store.getMeta(META.cursorSeq)).toBe('0')
    expect(await mobileCipher.mobile?.store.listRecords()).toEqual([])

    bump(clock)
    writer.engine.upsertRecord({ kind: 'note', fields: { title: 'second', body: 'sealed' } })
    await writer.engine.sync()

    const desktopChain = await freshReader(user, clock, 'desktop', 'tamper-prev-hash')
    await desktopChain.desktop?.engine.discover()
    await desktopChain.desktop?.engine.unlock(PASSPHRASE)
    await expect(desktopChain.desktop?.engine.sync()).rejects.toBeInstanceOf(SyncChainError)
    expect(desktopChain.desktop?.engine.status().cursor).toBe(0)
    expect(desktopChain.desktop?.engine.listRecords(undefined, true)).toEqual([])

    const mobileChain = await freshReader(user, clock, 'mobile', 'tamper-prev-hash')
    await mobileChain.mobile?.engine.unlock(PASSPHRASE)
    expect(mobileChain.mobile?.engine.lastResult?.status).toBe('error')
    expect(await mobileChain.mobile?.store.getMeta(META.cursorSeq)).toBe('0')
    expect(await mobileChain.mobile?.store.listRecords()).toEqual([])

    const desktopHead = await freshReader(user, clock, 'desktop', 'tamper-head')
    await desktopHead.desktop?.engine.discover()
    await desktopHead.desktop?.engine.unlock(PASSPHRASE)
    await expect(desktopHead.desktop?.engine.sync()).rejects.toBeInstanceOf(SyncChainError)
    expect(desktopHead.desktop?.engine.status().cursor).toBe(0)
    expect(desktopHead.desktop?.engine.listRecords(undefined, true)).toEqual([])
  })

  // Spec: a chain break applies nothing and leaves the cursor. Mobile checks headHash only
  // after it has decrypted and written the page, so a lied-about head still lands in the journal.
  it.fails('mobile applies nothing when the server headHash does not match the pulled page', async () => {
    const clock = clockAt()
    const user = testUser('tamper-head')
    const writer = openDesktop(worker.origin, user, clock)
    await writer.engine.setup(PASSPHRASE)
    bump(clock)
    writer.engine.upsertRecord({ kind: 'note', fields: { title: 'honest', body: 'sealed' } })
    await writer.engine.sync()

    const reader = await freshReader(user, clock, 'mobile', 'tamper-head')
    await reader.mobile?.engine.unlock(PASSPHRASE)
    expect(reader.mobile?.engine.lastResult?.status).toBe('error')
    expect(await reader.mobile?.store.getMeta(META.cursorSeq)).toBe('0')
    expect(await reader.mobile?.store.listRecords()).toEqual([])
  })

  // Mobile verifies a page's internal links, then decrypts and writes each op before the
  // page is compared to headHash. A later bad ciphertext therefore keeps the prefix.
  it.fails('mobile applies nothing from a page whose later ciphertext was tampered', async () => {
    const clock = clockAt()
    const user = testUser('tamper-page')
    const writer = openDesktop(worker.origin, user, clock)
    await writer.engine.setup(PASSPHRASE)
    bump(clock)
    writer.engine.upsertRecord({ kind: 'note', fields: { title: 'prefix', body: 'sealed' } })
    bump(clock)
    writer.engine.upsertRecord({ kind: 'note', fields: { title: 'suffix', body: 'sealed' } })
    await writer.engine.sync()

    const reader = await freshReader(user, clock, 'mobile', 'tamper-ciphertext')
    await reader.mobile?.engine.unlock(PASSPHRASE)
    expect(reader.mobile?.engine.lastResult?.status).toBe('error')
    expect(await reader.mobile?.store.getMeta(META.cursorSeq)).toBe('0')
    expect(await reader.mobile?.store.listRecords()).toEqual([])
  })

  it('makes a desktop vault reset visible to mobile, and the reverse', async () => {
    const clock = clockAt()
    const user = testUser('reset')
    const { desktop, mobile } = await openPair(worker.origin, user, clock)
    await desktop.engine.setup(PASSPHRASE)
    desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'kept', body: 'before' } })
    await desktop.engine.sync()
    await mobile.engine.unlock(PASSPHRASE)
    const retiredVaultId = desktop.engine.status().vaultId
    expect(retiredVaultId).toBeTruthy()

    await desktop.engine.reset(REPLACEMENT_PASSPHRASE)
    bump(clock)
    desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'after-reset', body: 'new' } })
    await desktop.engine.sync()
    expect(desktop.engine.status().vaultId).not.toBe(retiredVaultId)

    const seen = await mobile.engine.sync()
    expect(seen.status).toBe('vault_reset')
    expect(titles(await mobileRecords(mobile.store))).toEqual(['kept'])
    await expect(mobile.engine.replaceWithRemoteVault(PASSPHRASE)).rejects.toThrow(/passphrase/i)
    expect(titles(await mobileRecords(mobile.store))).toEqual(['kept'])
    await mobile.engine.replaceWithRemoteVault(REPLACEMENT_PASSPHRASE)
    expect(titles(await mobileRecords(mobile.store)).sort()).toEqual(['after-reset', 'kept'])

    const stale = await api(user, `/api/v1/sync/ops?vaultId=${retiredVaultId}&after=0`)
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ code: 'vault_reset' })

    const mobileOwner = testUser('reset-mobile')
    const mobileReset = await openPair(worker.origin, mobileOwner, clock)
    await mobileReset.mobile.engine.createVault(PASSPHRASE)
    await mobileReset.mobile.journal.createNote({ title: 'kept-on-phone', body: 'before' })
    await mobileReset.mobile.journal.sync()
    await mobileReset.desktop.engine.discover()
    await mobileReset.desktop.engine.unlock(PASSPHRASE)
    await mobileReset.desktop.engine.sync()
    const retiredByMobile = mobileReset.desktop.engine.status().vaultId

    await mobileReset.mobile.engine.resetVault(REPLACEMENT_PASSPHRASE)
    bump(clock)
    await mobileReset.mobile.journal.createNote({ title: 'after-mobile-reset', body: 'new' })
    await mobileReset.mobile.journal.sync()
    await expect(mobileReset.desktop.engine.sync()).rejects.toBeInstanceOf(SyncVaultResetError)
    expect(titles(desktopRecords(mobileReset.desktop.engine))).toEqual(['kept-on-phone'])
    await expect(mobileReset.desktop.engine.discardAndJoin(PASSPHRASE)).rejects.toThrow()
    expect(titles(desktopRecords(mobileReset.desktop.engine))).toEqual(['kept-on-phone'])
    await mobileReset.desktop.engine.discardAndJoin(REPLACEMENT_PASSPHRASE)
    expect(titles(desktopRecords(mobileReset.desktop.engine)).sort()).toEqual([
      'after-mobile-reset',
      'kept-on-phone',
    ])
    const staleMobile = await api(mobileOwner, `/api/v1/sync/ops?vaultId=${retiredByMobile}&after=0`)
    expect(staleMobile.status).toBe(409)
    expect(staleMobile.body).toMatchObject({ code: 'vault_reset' })
  })

  it('hides one account vault from a second account', async () => {
    const clock = clockAt()
    const owner = testUser('owner')
    const intruder = testUser('intruder')
    const { desktop, mobile } = await openPair(worker.origin, owner, clock)
    await desktop.engine.setup(PASSPHRASE)
    desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'owner-secret', body: 'private' } })
    await desktop.engine.sync()
    await mobile.engine.unlock(PASSPHRASE)
    const vaultId = desktop.engine.status().vaultId
    expect(vaultId).toBeTruthy()

    const missing = await api(intruder, '/api/v1/vault')
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ code: 'vault_not_found' })
    const head = await api(intruder, '/api/v1/sync')
    expect(head.status).toBe(404)
    expect(head.body).toMatchObject({ code: 'vault_not_found' })
    const stolen = await api(intruder, `/api/v1/sync/ops?vaultId=${vaultId}&after=0`)
    expect(stolen.status).toBe(404)
    expect(stolen.body).toMatchObject({ code: 'vault_not_found' })

    const other = await openPair(worker.origin, intruder, clock)
    await expect(other.mobile.engine.unlock(PASSPHRASE)).rejects.toThrow(/vault/i)
    expect(await other.desktop.engine.discover()).toBe('none')
    await other.desktop.engine.setup(PASSPHRASE)
    other.desktop.engine.upsertRecord({ kind: 'note', fields: { title: 'intruder-only', body: 'other' } })
    await other.desktop.engine.sync()
    expect(other.desktop.engine.status().vaultId).not.toBe(vaultId)
    expect(titles(desktopRecords(other.desktop.engine))).toEqual(['intruder-only'])
    await desktop.engine.sync()
    expect(titles(desktopRecords(desktop.engine))).toEqual(['owner-secret'])
    expect(titles(await mobileRecords(mobile.store))).toEqual(['owner-secret'])
  })
})
