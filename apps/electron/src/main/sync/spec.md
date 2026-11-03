# techoo encrypted sync v1 — client wire format

This is the canonical client contract for the desktop and mobile apps. The server stores the strings below and never interprets them. Golden bytes live in [`vectors/test-vectors.json`](vectors/test-vectors.json) next to this file. A client matches the protocol when its tests reproduce that file byte for byte.

Protocol id: `techoo-e2ee-sync-v1`.

Headless desktop entry point (no Electron import): `apps/electron/src/main/sync/index.ts`.

## Encoding

- Binary fields on the wire (`salt`, `wrappedKey`, `wrappedKeyNonce`, `nonce`, `ciphertext`) are standard Base64 (RFC 4648) with `=` padding. No whitespace, no URL-safe alphabet.
- The scrypt salt and the AES nonce are the raw bytes decoded from that Base64, not the Base64 text.
- Text is UTF-8. Passphrases are NFKC-normalized before UTF-8 encoding. Do not trim and do not append a NUL.
- UUIDs (`recordId`, `deviceId`, `clientOpId`, and the payload's `recordId`) are lowercase `8-4-4-4-12` hex. The hash preimage uses those exact strings.
- Timestamps inside a payload are `Date.toISOString()`: `YYYY-MM-DDTHH:mm:ss.sssZ`. Lexicographic order is chronological order. Other offsets are invalid.

## Passphrase and scrypt

KDF name on the wire: `scrypt` (RFC 7914, the algorithm Node's `crypto.scrypt` / OpenSSL `EVP_PBE_scrypt` implement).

Parameters, all required for vaults this client creates:

| Field    | Value   | Rule                                            |
| -------- | ------- | ----------------------------------------------- |
| `N`      | `16384` | Power of two, server range 1024..1048576        |
| `r`      | `8`     | Server range 1..32                              |
| `p`      | `1`     | Server range 1..16                              |
| `keyLen` | `32`    | Omitted means 32. Any other length is rejected. |

`keyLen` is the wrapping-key size in bytes. The data key is a separate 32 random bytes.

Salt is 16 random bytes. Memory for these parameters is `128 * N * r * p` bytes (16 MiB). Set the implementation's memory cap above that.

Self-check, before the protocol vectors. RFC 7914, `P = "password"`, `S = "NaCl"`, `N = 1024`, `r = 8`, `p = 16`, `dkLen = 64`:

```
fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640
```

A minimum passphrase length is a user-interface choice. It is not part of the KDF input.

## Key wrap

AES-256-GCM.

- Key: the 32-byte scrypt output.
- Nonce: 12 random bytes, stored in `wrappedKeyNonce` as Base64.
- Plaintext: the raw 32-byte data key (not encoded).
- Associated data: the UTF-8 bytes of the exact string `techoo.vault.wrap.v1`.
- `wrappedKey`: Base64 of `ciphertext || 16-byte tag`. The tag is last, which is the WebCrypto `encrypt` layout. Node's `getAuthTag()` is appended, not prepended.

A wrong passphrase, a flipped tag byte, or different associated data must fail authentication. Do not unwrap on failure.

The data key is kept in process memory after unlock. It is not written to disk and it is not sent to the renderer. The on-disk journal is plaintext. The wrapped key may be cached so unlock works offline.

## Record payload

UTF-8 JSON object, canonicalized:

- No insignificant whitespace.
- Object keys sorted by ascending UTF-16 code unit. ASCII keys sort the same as bytes.
- `JSON.stringify` string escaping (ECMA-262). Do not escape `/`.
- Numbers are safe integers. Booleans and strings are allowed. `null` is not used.
- Empty optional strings are omitted. Unknown keys are preserved on later edits.

Top-level keys, in order: `deleted`, `fields`, `kind`, `recordId`, `updatedAt`, `v`.

`v` is `1`. `kind` is `todo`, `post`, or `note`. `deleted` is a boolean. `recordId` equals the op's `recordId`. `updatedAt` is the writer clock used for merge.

Required `fields` when `deleted` is false:

| Kind   | Required                                                                  | Optional strings, omitted when empty                                          |
| ------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `todo` | `title` string, `createdAt` timestamp, `done` boolean, `isAllDay` boolean | `description`, `startsAt`, `endsAt`, `doneAt` (the last three are timestamps) |
| `note` | `title` string, `createdAt` timestamp, `pinned` boolean                   | `body`                                                                        |
| `post` | `body` string, `postedAt` timestamp                                       | `parentRecordId` (lowercase UUID of another post)                             |

A tombstone is `deleted: true` and `fields: {}`. A tombstone with any field is invalid. `recordId` does not change when a row is deleted, and `kind` does not change for a `recordId`.

Worked note plaintext (also `records[0].plaintext` in the vectors):

```
{"deleted":false,"fields":{"body":"Buy milk","createdAt":"2026-11-03T03:00:00.000Z","pinned":false,"title":"Milk"},"kind":"note","recordId":"11111111-1111-4111-8111-111111111111","updatedAt":"2026-11-03T03:00:00.000Z","v":1}
```

Tombstone of that note:

```
{"deleted":true,"fields":{},"kind":"note","recordId":"11111111-1111-4111-8111-111111111111","updatedAt":"2026-11-03T04:00:00.000Z","v":1}
```

## Record encryption

AES-256-GCM with the data key.

- Nonce: 12 random bytes. The op's `nonce` is Base64 of those bytes.
- Plaintext: the canonical JSON UTF-8 bytes.
- Associated data: UTF-8 of `techoo.sync.v1|` plus the lowercase `recordId`. The worked note uses `techoo.sync.v1|11111111-1111-4111-8111-111111111111`.
- `ciphertext`: Base64 of `ciphertext || 16-byte tag`.

Decrypt with the op's `recordId` as the associated data. If authentication fails, or the JSON is not a v1 payload, or `payload.recordId` differs from the op, stop the pull. Do not skip the op and do not advance the cursor.

The same `clientOpId` is reused with the same nonce and ciphertext until that op shows up in a pulled page. Generating a new nonce for a retry stores a different body under a new id and forks the record. Edits made after sealing wait until that op is acknowledged, then go out as a new `clientOpId`.

`deviceId` is a UUID created once per install and stored with the local journal. It is not secret. `clientOpId` is a new UUID per sealed snapshot. Neither value is inside the ciphertext. The server's hash does not cover `deviceId`, `clientOpId`, or `nonce`.

## Hash chain

Matches the server. Genesis is 64 ASCII `0` characters. There is no SHA-256 of an empty string involved.

```
preimage = prevHash + "|" + decimal(seq) + "|" + recordId + "|" + ciphertext
hash     = lowercase hex SHA-256 of the UTF-8 preimage
```

`seq` has no leading zeros. `ciphertext` is the Base64 string, not the raw bytes. The first op's `prevHash` is genesis. Each later `prevHash` is the previous op's hash. `GET /api/v1/sync` `headHash` must equal the hash of the last op. `GET /api/v1/sync/ops` does not return `headHash`; do not treat a pull as verified without the head endpoint.

Worked chain (see `chain.ops` for the full preimages):

| seq | record                                      | hash                                                               |
| --- | ------------------------------------------- | ------------------------------------------------------------------ |
| 1   | note `11111111-1111-4111-8111-111111111111` | `e567bf54027b9db2c46dd0c6ae0b02575ef2cdadf1ba5f63dea8dc3996f155ef` |
| 2   | todo `22222222-2222-4222-8222-222222222222` | `620ba8dba757afb3ad31c96e31235d6f5b974daf9fe195f69c6dd2cdc9e1bd8d` |
| 3   | tombstone of the note                       | `f1c829be1308c65bd16051c1aa28c1d334441fb5dd8a61075b053532e73b392b` |

Flipping the last byte of the note ciphertext yields Base64 ending in `Rrc` instead of `Rrd` and hash `83ec7e2408ae137cb3d1b634ead9b35605e3d3b2c46c45ddeb1420b21dfa52b0`, which is not seq 2's `prevHash`. A gap, a mismatched `prevHash`, or a final hash that is not `headHash` is a chain break: apply nothing and leave the cursor where it was.

Pull every op with `seq` greater than the cursor, in order, before applying any of them. Pages are at most 100. Re-read the head after the last page so an append that landed during the pull is included. The cursor advances only inside the same local transaction as the applies.

## Merge

Last writer wins per `recordId`. Compare the incoming op with the stored row:

1. Greater `updatedAt` wins.
2. If those are equal, the greater lowercase `deviceId` wins.
3. If those are equal, the greater `seq` wins.
4. If all three are equal, keep the row already stored. Replaying the same op is a no-op.

An edit that has not been assigned a `seq` is compared as `seq = 0` and `deviceId` = this device. A synced op with the same timestamp and device therefore replaces that unpushed copy. A newer local `updatedAt` still beats an older remote op, including a tombstone.

The comparison does not depend on arrival order. Applying the newer op first and the older op second leaves the newer row. The log is still verified and applied in `seq` order; the order independence is what keeps two devices that both have the same set of versions converged.

The winning remote row replaces `kind`, `deleted`, `fields`, `updatedAt`, `originSeq`, and `originDeviceId`, and clears the dirty bit. A tie leaves the stored row untouched, including a dirty bit. Tombstones stay in the local table so an older op cannot resurrect them. The user interface hides `deleted` rows.

`mergeCases` in the vector file is the normative list: newer timestamp, older timestamp, device-id tiebreak, seq tiebreak, total tie, newer tombstone, older tombstone, out-of-order convergence, idempotent replay, synced replay of an unpushed same-timestamp edit, and a newer unpushed local edit.

## Vault lifecycle

`PUT /api/v1/vault` body:

```json
{
  "salt": "<base64>",
  "kdf": "scrypt",
  "kdfParams": { "N": 16384, "r": 8, "p": 1, "keyLen": 32 },
  "wrappedKey": "<base64 ciphertext||tag>",
  "wrappedKeyNonce": "<base64 12-byte nonce>"
}
```

`409 vault_exists` means a vault is already active. Do not generate a second data key and upload this device's journal over it. Either unlock the server's wrapped key and replace the local journal with a pull from genesis, or `POST /api/v1/vault/reset` with a wrapped key this device can unwrap and re-upload the local journal. Reset deletes the server log. `409 vault_reset` on push or pull means the `vaultId` is no longer active; stop and ask the user before uploading the old journal into the new vault.

Offline: local edits land in the plaintext journal immediately. Sealed ops stay queued. Unlock uses the cached wrap and does not need the network. Creating the first vault can happen offline; `PUT` runs on the next successful sync. A reset requested while offline stays queued as `POST /api/v1/vault/reset` before any push.

Push batches contain at most 50 ops, the server maximum. A repeated `clientOpId` returns the original `seq` and must not change the ciphertext the client will acknowledge.

## Golden inputs

| Item             | Value                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Passphrase       | `correct horse battery staple`                                                                                                                 |
| Wrong passphrase | `wrong passphrase`                                                                                                                             |
| Salt hex         | `00112233445566778899aabbccddeeff`                                                                                                             |
| Data key hex     | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f`                                                                             |
| Wrap nonce hex   | `c0c1c2c3c4c5c6c7c8c9cacb`                                                                                                                     |
| Wrapping key     | `/NWljVMBu8ROkPyaU/FWE0uu55XrdzXtZHPahuNLqTA=`                                                                                                 |
| Wrapped data key | `FSJg9Bv0i+f+HMiZ5PdZQzjRHN+dSckDDzkQ9INVAhhVrFOOZeQef8T15f39vSwo`                                                                             |
| Note nonce       | `d0d1d2d3d4d5d6d7d8d9dadb`                                                                                                                     |
| Note ciphertext  | `records[0].ciphertextBase64`                                                                                                                  |
| NFKC pair        | `café` (U+00E9) and code points `[99, 97, 102, 101, 769]` share wrapping key `GJcguUcVs8cmvxrV4KLqjnMl6zHUCC9BFIsiCLPMxnA=` over the same salt |

Regenerate the JSON only by running `pnpm exec tsx apps/electron/src/main/sync/vectors/generate.ts` from the repo root, then update this document's worked hashes if they move. The committed JSON is what the tests assert.
