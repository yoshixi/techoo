-- Encrypted sync vault. One active row per user (retired_at IS NULL).
-- The worker stores the wrapped data key and never the passphrase.
CREATE TABLE vaults (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  salt TEXT NOT NULL,
  kdf TEXT NOT NULL,
  kdf_params TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  wrapped_key_nonce TEXT NOT NULL,
  head_seq INTEGER NOT NULL DEFAULT 0,
  head_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  retired_at INTEGER
);

CREATE UNIQUE INDEX vaults_one_active_per_user
  ON vaults (user_id)
  WHERE retired_at IS NULL;

CREATE INDEX vaults_user_id_idx ON vaults (user_id);

-- Append-only ciphertext log. plaintext never lands in this table.
CREATE TABLE sync_ops (
  vault_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  client_op_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (vault_id, seq),
  UNIQUE (vault_id, client_op_id)
);

CREATE INDEX sync_ops_vault_seq_idx ON sync_ops (vault_id, seq);
