import React, { useCallback, useEffect, useState } from 'react'
import { ListTodo, Lock, NotebookPen, RefreshCw, ScrollText } from 'lucide-react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'

type JournalKind = 'todo' | 'post' | 'note'

interface SyncStatusPayload {
  phase: 'setup' | 'locked' | 'ready' | 'offline' | 'conflict' | 'error'
  unlocked: boolean
  hasLocalVault: boolean
  vaultId: string | null
  deviceId: string
  cursor: number
  pendingCount: number
  dirtyCount: number
  lastSyncedAt: string | null
  lastError: string | null
}

interface JournalRecordPayload {
  recordId: string
  kind: JournalKind
  deleted: boolean
  updatedAt: string
  fields: Record<string, string | number | boolean>
  dirty: boolean
}

const kinds: { id: JournalKind; label: string }[] = [
  { id: 'note', label: 'Notes' },
  { id: 'todo', label: 'Todos' },
  { id: 'post', label: 'Posts' }
]

function fieldText(record: JournalRecordPayload | undefined, key: string): string {
  const value = record?.fields[key]
  return typeof value === 'string' ? value : ''
}

function fieldFlag(record: JournalRecordPayload | undefined, key: string): boolean {
  return record?.fields[key] === true
}

function statusLine(status: SyncStatusPayload): string {
  if (status.phase === 'offline') {
    return status.lastError ?? 'Saved on this device. Sync will retry when the network is back.'
  }
  if (status.phase === 'error') return status.lastError ?? 'Sync failed'
  const waiting = status.pendingCount + status.dirtyCount
  if (waiting > 0) return `${waiting} change${waiting === 1 ? '' : 's'} waiting to sync`
  return status.lastSyncedAt ? 'Synced' : 'Unlocked'
}

function PassphraseFields({
  idPrefix,
  passphrase,
  confirm,
  onPassphrase,
  onConfirm,
  showConfirm
}: {
  idPrefix: string
  passphrase: string
  confirm: string
  onPassphrase: (value: string) => void
  onConfirm: (value: string) => void
  showConfirm: boolean
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-passphrase`}>Passphrase</Label>
        <Input
          id={`${idPrefix}-passphrase`}
          type="password"
          autoComplete="new-password"
          value={passphrase}
          onChange={(event) => onPassphrase(event.target.value)}
        />
      </div>
      {showConfirm && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-passphrase-confirm`}>Confirm passphrase</Label>
          <Input
            id={`${idPrefix}-passphrase-confirm`}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => onConfirm(event.target.value)}
          />
        </div>
      )}
    </div>
  )
}

export function SyncJournalView(): React.JSX.Element {
  const [status, setStatus] = useState<SyncStatusPayload | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showRecover, setShowRecover] = useState(false)
  const [kind, setKind] = useState<JournalKind>('note')
  const [records, setRecords] = useState<JournalRecordPayload[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)
  const [pinned, setPinned] = useState(false)

  const applyStatus = useCallback((next: SyncStatusPayload): void => {
    setStatus(next)
  }, [])

  const reload = useCallback(
    async (nextKind: JournalKind, preferId?: string | null): Promise<void> => {
      const listed = await window.api.journalList(nextKind)
      applyStatus(listed.status)
      const rows = listed.records ?? []
      setRecords(rows)
      const id =
        preferId && rows.some((row) => row.recordId === preferId)
          ? preferId
          : (rows[0]?.recordId ?? null)
      setSelectedId(id)
      const selected = rows.find((row) => row.recordId === id)
      setTitle(fieldText(selected, 'title'))
      setBody(fieldText(selected, nextKind === 'todo' ? 'description' : 'body'))
      setDone(fieldFlag(selected, 'done'))
      setPinned(fieldFlag(selected, 'pinned'))
    },
    [applyStatus]
  )

  useEffect(() => {
    let cancelled = false
    void window.api.syncPrepare().then((result) => {
      if (!cancelled) applyStatus(result.status)
    })
    const unsubscribe = window.api.onSyncStatus((next) => applyStatus(next))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [applyStatus])

  useEffect(() => {
    if (!status?.unlocked) return
    let cancelled = false
    void window.api.journalList(kind).then((listed) => {
      if (cancelled) return
      applyStatus(listed.status)
      const rows = listed.records ?? []
      setRecords(rows)
      setSelectedId((current) =>
        current && rows.some((row) => row.recordId === current) ? current : null
      )
    })
    return () => {
      cancelled = true
    }
  }, [status?.unlocked, status?.cursor, kind, applyStatus])

  const selected = records.find((row) => row.recordId === selectedId) ?? null

  const choose = (record: JournalRecordPayload): void => {
    setSelectedId(record.recordId)
    setTitle(fieldText(record, 'title'))
    setBody(fieldText(record, kind === 'todo' ? 'description' : 'body'))
    setDone(fieldFlag(record, 'done'))
    setPinned(fieldFlag(record, 'pinned'))
    setFormError(null)
  }

  const requireNewPassphrase = (): string | null => {
    if (passphrase.length < 8) return 'Use at least 8 characters.'
    if (passphrase !== confirm) return 'The passphrases do not match.'
    return null
  }

  const run = async (
    fn: () => Promise<{ ok: boolean; reason: string | null; status: SyncStatusPayload }>
  ): Promise<boolean> => {
    setBusy(true)
    setFormError(null)
    try {
      const result = await fn()
      applyStatus(result.status)
      if (!result.ok) {
        setFormError(result.reason)
        return false
      }
      setPassphrase('')
      setConfirm('')
      return true
    } finally {
      setBusy(false)
    }
  }

  const save = async (recordId?: string): Promise<void> => {
    const fields: Record<string, string | number | boolean> =
      kind === 'todo'
        ? { title, description: body, done, isAllDay: false }
        : kind === 'note'
          ? { title, body, pinned }
          : { body }
    const result = await window.api.journalSave({ recordId, kind, fields })
    applyStatus(result.status)
    if (!result.ok) {
      setFormError(result.reason)
      return
    }
    await reload(kind, result.record?.recordId ?? recordId)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto">
      <div className="px-5 py-4 space-y-4 max-w-3xl w-full mx-auto">
        <div>
          <h1 className="text-lg font-semibold">Encrypted journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Notes, todos, and posts stay in plaintext on this device. The server only stores
            ciphertext. Calendar and the existing Todo and Timeline tabs still use the account
            database.
          </p>
        </div>

        {status?.phase === 'conflict' && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm">
              {status.lastError ?? 'The server vault does not match this device.'} Downloading the
              server vault deletes the journal stored on this device. Replacing the server vault
              deletes the encrypted log and uploads this device&apos;s journal.
            </p>
            <PassphraseFields
              idPrefix="join"
              passphrase={passphrase}
              confirm={confirm}
              onPassphrase={setPassphrase}
              onConfirm={setConfirm}
              showConfirm={false}
            />
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || passphrase.length === 0}
                onClick={() => void run(() => window.api.syncDiscardAndJoin(passphrase))}
              >
                Download server vault
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => window.api.syncReplaceServer())}
              >
                Replace server vault
              </Button>
            </div>
          </div>
        )}

        {status && !status.unlocked && !status.hasLocalVault && (
          <form
            className="space-y-3 rounded-xl border p-4"
            onSubmit={(event) => {
              event.preventDefault()
              const problem = requireNewPassphrase()
              if (problem) {
                setFormError(problem)
                return
              }
              void run(() => window.api.syncSetup(passphrase))
            }}
          >
            <p className="text-sm">
              Create a vault with a passphrase. It can be registered the next time this device is
              online.
            </p>
            <PassphraseFields
              idPrefix="setup"
              passphrase={passphrase}
              confirm={confirm}
              onPassphrase={setPassphrase}
              onConfirm={setConfirm}
              showConfirm
            />
            {(formError || status.lastError) && (
              <p className="text-sm text-destructive">{formError ?? status.lastError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                Create vault
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => window.api.syncPrepare())}
              >
                Check for an existing vault
              </Button>
            </div>
          </form>
        )}

        {status && !status.unlocked && status.hasLocalVault && (
          <form
            className="space-y-3 rounded-xl border p-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (showRecover) {
                const problem = requireNewPassphrase()
                if (problem) {
                  setFormError(problem)
                  return
                }
                void run(() => window.api.syncReset(passphrase))
                return
              }
              if (passphrase.length === 0) {
                setFormError('Enter the passphrase.')
                return
              }
              void run(() => window.api.syncUnlock(passphrase))
            }}
          >
            <p className="text-sm">
              {showRecover
                ? 'A new passphrase wraps a new data key. Notes on this device are kept and uploaded again. The previous server log is deleted.'
                : 'Unlock with the passphrase that wrapped this device\u2019s data key. Unlock works offline after the vault has been saved here.'}
            </p>
            <PassphraseFields
              idPrefix="unlock"
              passphrase={passphrase}
              confirm={confirm}
              onPassphrase={setPassphrase}
              onConfirm={setConfirm}
              showConfirm={showRecover}
            />
            {(formError || status.lastError) && (
              <p className="text-sm text-destructive">{formError ?? status.lastError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {showRecover ? 'Replace the vault' : 'Unlock'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setShowRecover((value) => !value)
                  setFormError(null)
                }}
              >
                {showRecover ? 'Back to unlock' : 'I forgot the passphrase'}
              </Button>
            </div>
          </form>
        )}

        {status?.unlocked && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{statusLine(status)}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void run(() => window.api.syncNow())}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void run(() => window.api.syncLock())}
              >
                <Lock className="h-3.5 w-3.5" />
                Lock
              </Button>
            </div>

            <div className="flex gap-1.5">
              {kinds.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="px-3 py-1.5 rounded-full text-xs"
                  style={{
                    fontWeight: kind === entry.id ? 500 : 400,
                    color: kind === entry.id ? 'var(--text-dark)' : 'var(--text-muted-custom)',
                    background:
                      kind === entry.id
                        ? 'color-mix(in srgb, var(--card) 86%, #fff 14%)'
                        : 'transparent'
                  }}
                  onClick={() => {
                    setKind(entry.id)
                    setSelectedId(null)
                    setTitle('')
                    setBody('')
                    setDone(false)
                    setPinned(false)
                  }}
                >
                  {entry.id === 'note' && <NotebookPen className="inline h-3.5 w-3.5 mr-1" />}
                  {entry.id === 'todo' && <ListTodo className="inline h-3.5 w-3.5 mr-1" />}
                  {entry.id === 'post' && <ScrollText className="inline h-3.5 w-3.5 mr-1" />}
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <div className="rounded-xl border overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs border-b hover:bg-accent/50"
                  onClick={() => {
                    setSelectedId(null)
                    setTitle('')
                    setBody('')
                    setDone(false)
                    setPinned(false)
                  }}
                >
                  New {kind}
                </button>
                {records.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">Nothing here yet.</p>
                )}
                {records.map((record) => (
                  <button
                    key={record.recordId}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-xs border-b ${
                      record.recordId === selectedId ? 'bg-accent' : 'hover:bg-accent/40'
                    }`}
                    onClick={() => choose(record)}
                  >
                    <span className="block truncate font-medium">
                      {fieldText(record, kind === 'post' ? 'body' : 'title') || 'Untitled'}
                    </span>
                    {record.dirty && <span className="text-muted-foreground">Not synced</span>}
                  </button>
                ))}
              </div>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void save(selected?.recordId)
                }}
              >
                {kind !== 'post' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="journal-title">Title</Label>
                    <Input
                      id="journal-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="journal-body">{kind === 'todo' ? 'Description' : 'Body'}</Label>
                  <Textarea
                    id="journal-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                  />
                </div>
                {kind === 'todo' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(event) => setDone(event.target.checked)}
                    />
                    Done
                  </label>
                )}
                {kind === 'note' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={pinned}
                      onChange={(event) => setPinned(event.target.checked)}
                    />
                    Pinned
                  </label>
                )}
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                  {selected && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void window.api.journalDelete(selected.recordId).then((result) => {
                          applyStatus(result.status)
                          void reload(kind, null)
                        })
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </form>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Reset the server vault
              </summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  const problem = requireNewPassphrase()
                  if (problem) {
                    setFormError(problem)
                    return
                  }
                  void run(() => window.api.syncReset(passphrase))
                }}
              >
                <p className="text-muted-foreground">
                  This deletes the encrypted log and uploads this device&apos;s journal under a new
                  data key. Other devices have to join again.
                </p>
                <PassphraseFields
                  idPrefix="reset"
                  passphrase={passphrase}
                  confirm={confirm}
                  onPassphrase={setPassphrase}
                  onConfirm={setConfirm}
                  showConfirm
                />
                <Button type="submit" variant="destructive" disabled={busy}>
                  Reset vault
                </Button>
              </form>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
