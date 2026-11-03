---
date: 2026-11-03
status: accepted
branch: cursor/electron-e2ee-sync-20d9
---

# Desktop client for encrypted sync

## Context

The worker on `cursor/e2ee-sync-d1-d81a` stores a wrapped data key and an append-only ciphertext log. It does not decrypt. The desktop app still reads the journal from Turso. This change adds the device half: plaintext SQLite in the Electron main process, a passphrase-derived wrapping key, and sync against that log.

Constraints:

- No changes to `apps/backend` or `apps/mobile`. A mobile client is being written against the same bytes.
- Existing Todo, Timeline, and Settings screens keep using Turso. There is no migration off Turso.
- The data key stays in the main process. The renderer sends the passphrase and receives plaintext records over IPC.
- The sync core has to run under plain Node so a later harness can drive two devices without Electron.

## Decision

The canonical byte format is `apps/electron/src/main/sync/spec.md`. Golden inputs and outputs are `apps/electron/src/main/sync/vectors/test-vectors.json`. The headless API is `apps/electron/src/main/sync/index.ts` (`SyncEngine`, `createFetchTransport`, `SqliteJournalStore`, plus the crypto, chain, and merge functions).

- scrypt (`N=16384`, `r=8`, `p=1`, `keyLen=32`) derives a 32-byte wrapping key. AES-256-GCM wraps a random 32-byte data key with associated data `techoo.vault.wrap.v1`. The tag is appended to the ciphertext.
- Each journal snapshot is canonical JSON encrypted with AES-256-GCM. Associated data is `techoo.sync.v1|<recordId>`. A sealed op keeps its `clientOpId`, nonce, and ciphertext until the server log echoes it.
- The hash chain is the server's: SHA-256 over `prevHash|seq|recordId|ciphertext`, genesis 64 zeroes. The client pulls the whole gap, checks it against `GET /api/v1/sync` `headHash`, and only then merges.
- Merge is last-writer-wins per record. `updatedAt`, then `deviceId`, then `seq`. A total tie keeps the stored row. Tombstones stay in SQLite. An unpushed edit uses `seq` 0.
- Offline edits are written locally and sealed on the next sync. Unlock uses the cached wrap. A vault id mismatch stops the sync until the user downloads the server vault or replaces it.

The Journal tab is new. It does not replace the Turso-backed Todo or Timeline tabs.

## Consequences

- The on-disk journal is plaintext. The passphrase protects the server log and the ability to read other devices, not the local SQLite file.
- A reset deletes the server log and re-uploads this device. Other devices must join the new vault; they are not merged automatically.
- `keyLen` other than 32 and a non-power-of-two `N` are rejected even though the server schema allows a wider range.
- Production sync still returns `503 sync_unavailable` until the worker's D1 binding exists. The desktop client surfaces that as a sync error and keeps the local journal.
