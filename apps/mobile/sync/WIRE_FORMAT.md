# Mobile encrypted sync wire format

The desktop client owns this contract. The normative copy is the desktop spec (`techoo-e2ee-sync-v1`). This file is the mobile implementation's matching description. Golden bytes are in `apps/mobile/__tests__/fixtures/sync-vectors.json`, copied from the desktop vectors. A change to those bytes has to come from the desktop generator, not from this app.

Protocol id: `techoo-e2ee-sync-v1`.

Headless entry point, with no React Native import: `apps/mobile/sync/index.ts`. Node's `node:sqlite` adapter is `apps/mobile/sync/node.ts` (`openNodeSqliteDatabase`). The default crypto adapter is `@noble/hashes` scrypt and `@noble/ciphers` AES-GCM because Hermes has no `crypto.scrypt`. The tests check those bytes against the desktop vectors and against Node `crypto`.

## Encoding

- `salt`, `wrappedKey`, `wrappedKeyNonce`, `nonce`, and `ciphertext` are standard Base64 with `=` padding. Not base64url.
- Scrypt salt and AES nonce are the raw decoded bytes.
- Text is UTF-8. Passphrases are NFKC-normalized. They are not trimmed and have no trailing NUL.
- UUIDs are lowercase. `deviceId` is created once per install. `clientOpId` is a new UUID per sealed snapshot. Neither is inside the ciphertext.
- Timestamps are `Date.toISOString()` (`YYYY-MM-DDTHH:mm:ss.sssZ`).

## Scrypt

`kdf` is `scrypt` (RFC 7914, the same algorithm as Node `crypto.scrypt`).

Vaults this client creates use `N=16384`, `r=8`, `p=1`, `keyLen=32`. A missing `keyLen` means 32. Any other length is rejected. Salt is 16 bytes. The data key is a separate 32 random bytes. The memory cap must be above `128 * N * r * p` (16 MiB).

RFC 7914 self-check: `P = "password"`, `S = "NaCl"`, `N = 1024`, `r = 8`, `p = 16`, `dkLen = 64` is

```text
fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640
```

## Key wrap

AES-256-GCM.

- Key: the 32-byte scrypt output.
- Nonce: 12 random bytes, Base64 in `wrappedKeyNonce`.
- Plaintext: the raw 32-byte data key.
- Associated data: UTF-8 of `techoo.vault.wrap.v1`.
- `wrappedKey`: Base64 of `ciphertext || 16-byte tag`.

The data key stays in memory. The wrapped key is cached so unlock works offline. The on-disk journal is plaintext.

## Record payload

Canonical JSON: no insignificant whitespace, object keys sorted by UTF-16 code unit, `JSON.stringify` escaping, no escaped `/`. `null` is not used. Empty optional strings are omitted. Unknown keys are kept.

Top-level keys: `deleted`, `fields`, `kind`, `recordId`, `updatedAt`, `v`.

`v` is `1`. `kind` is `todo`, `post`, or `note`. A tombstone is `deleted: true` and `fields: {}`.

| Kind   | Required                                                 | Optional, omitted when empty                  |
| ------ | -------------------------------------------------------- | --------------------------------------------- |
| `todo` | `title`, `createdAt`, `done` boolean, `isAllDay` boolean | `description`, `startsAt`, `endsAt`, `doneAt` |
| `note` | `title`, `createdAt`, `pinned` boolean                   | `body`                                        |
| `post` | `body`, `postedAt`                                       | `parentRecordId`                              |

Worked note:

```text
{"deleted":false,"fields":{"body":"Buy milk","createdAt":"2026-11-03T03:00:00.000Z","pinned":false,"title":"Milk"},"kind":"note","recordId":"11111111-1111-4111-8111-111111111111","updatedAt":"2026-11-03T03:00:00.000Z","v":1}
```

Mobile also writes these extra post fields so a second phone keeps associations. A peer that preserves unknown keys will round-trip them: `todoRecordIds` (lowercase UUID strings), `events` (`{ "id": number, "title": string }`), and `favorited` (boolean, omitted when false). Post lists are not a sync kind. They stay in this device's SQLite.

## Record encryption

AES-256-GCM with the data key.

- Nonce: 12 random bytes, Base64 in `nonce`.
- Plaintext: the canonical JSON.
- Associated data: UTF-8 of `techoo.sync.v1|` plus the lowercase `recordId`.
- `ciphertext`: Base64 of `ciphertext || 16-byte tag`.

The same `clientOpId`, nonce, and ciphertext are reused until that op is pulled. A later edit uses a new `clientOpId`. Authentication failure, a payload that is not v1, or a `recordId` mismatch stops the pull and does not move the cursor.

## Hash chain

Genesis is 64 `0` characters.

```text
preimage = prevHash + "|" + decimal(seq) + "|" + recordId + "|" + ciphertext
hash     = lowercase hex SHA-256 of the UTF-8 preimage
```

`ciphertext` is the Base64 string. The worked chain hashes are in the vector file (`e567bf54027b9db2c46dd0c6ae0b02575ef2cdadf1ba5f63dea8dc3996f155ef`, then `620ba8dba757afb3ad31c96e31235d6f5b974daf9fe195f69c6dd2cdc9e1bd8d`, then `f1c829be1308c65bd16051c1aa28c1d334441fb5dd8a61075b053532e73b392b`). A gap, a bad `prevHash`, or a final hash that is not `headHash` applies nothing.

Pull `seq` greater than the cursor, verify the whole page, then apply. Pages are at most 100. Re-read the head after the last page. Push batches contain at most 50 ops.

## Merge

Last writer wins per `recordId`:

1. Greater `updatedAt` wins.
2. Then the greater lowercase `deviceId`.
3. Then the greater `seq`.
4. If all three match, keep the stored row. Replay is a no-op.

An edit with no `seq` yet is compared as `seq = 0` and `deviceId` = this device. A synced copy with the same timestamp and device replaces that unpushed row. A newer local `updatedAt` beats an older remote op, including a tombstone. The winner replaces the row and clears dirty. A tie leaves dirty as it was. Tombstones stay in the table. The UI hides them. The same set of versions converges in any order. `mergeCases` in the vector file is the normative list.

## Vault lifecycle

`PUT /api/v1/vault` sends `salt`, `kdf: "scrypt"`, `kdfParams`, `wrappedKey`, and `wrappedKeyNonce`. `409 vault_exists` does not upload this device's journal over the existing vault. The user either unlocks and replaces the local journal with a pull, or resets and re-uploads. `409 vault_reset` stops the sync until the user joins the new vault.

Creating a vault or requesting a reset while offline stores the wrapped key locally. The `PUT` or `POST /api/v1/vault/reset` runs on the next sync, and the reset runs before any push. Unlock uses the cached wrap and does not need the network.
