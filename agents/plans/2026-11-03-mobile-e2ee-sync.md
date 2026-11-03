---
date: 2026-11-03
status: accepted
branch: cursor/mobile-e2ee-sync-7738
---

# Mobile client for encrypted sync

## Context

The worker already stores a wrapped data key and an append-only ciphertext log. The phone still reads the journal from Turso. The owner should keep plaintext on the device, encrypt it with a passphrase, and merge other devices' snapshots. A desktop client is being written against the same server contract, so the byte layout has to be explicit. Existing calendar, account, and OAuth screens stay on Turso. There is no automatic copy of Turso journal rows.

## Decision

The sync core lives in `apps/mobile/sync` and imports no React Native modules. `apps/mobile/sync/index.ts` exports the crypto adapter, chain check, merge, engine, journal repository, and SQLite store interface. `apps/mobile/sync/node.ts` adds Node's `node:sqlite` for a headless harness. The app binds Expo SQLite in `apps/mobile/lib/journal/expoDb.ts` and the generated API in `apps/mobile/lib/journal/transport.ts`.

The wire format is the desktop contract `techoo-e2ee-sync-v1`, copied into `apps/mobile/sync/WIRE_FORMAT.md`. Golden vectors are committed at `apps/mobile/__tests__/fixtures/sync-vectors.json`. Defaults are scrypt `N=16384,r=8,p=1,keyLen=32`, AES-256-GCM with a 12-byte nonce and the tag appended, wrap AAD `techoo.vault.wrap.v1`, and record AAD `techoo.sync.v1|{recordId}`. Passphrases are NFKC. Merge is last-writer-wins on `updatedAt`, then `deviceId`, then `seq`, with an unpushed edit compared as seq 0. Only `todo`, `note`, and `post` are sync records. Post lists stay on the device. Posts may carry extra `todoRecordIds`, `events`, and `favorited` fields, which the spec says peers must preserve.

The journal screens keep calling Turso until Settings creates or unlocks a vault. After that they read and write the local SQLite journal. The data key is memory-only. Offline edits stay dirty and sync when the device is unlocked and online.

## Consequences

- Turso journal data is not migrated. Switching to a vault shows the encrypted journal, which starts empty on this device unless another device has already uploaded snapshots.
- Hermes does not provide `crypto.scrypt`. The default adapter is `@noble/hashes` and `@noble/ciphers`. The golden-vector tests decrypt the desktop ciphertext and match Node `crypto` for scrypt and AES-GCM, so the format is unchanged.
- A vault can be created offline. The wrapped key is cached and `PUT` runs on the next sync. Reset requested offline is sent before the following push. Unlock uses the cached wrap.
- Background sync uses the generated client inside `withSilentApiErrors` so an expected 404 or a retry does not raise the global error alert.
- Reset from this device re-uploads the local journal. Joining a vault reset from another device deletes local rows only after the new passphrase unwraps.
