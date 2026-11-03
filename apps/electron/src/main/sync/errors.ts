/** Authentication failed: wrong key, wrong passphrase, tampered ciphertext, or wrong AAD. */
export class CryptoAuthError extends Error {
  readonly code = 'auth' as const

  constructor(message = 'decryption authentication failed') {
    super(message)
    this.name = 'CryptoAuthError'
  }
}

/** HTTP or transport failure talking to the sync API. status 0 means the network call did not complete. */
export class SyncRequestError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, code: string | null, message: string) {
    super(message)
    this.name = 'SyncRequestError'
    this.status = status
    this.code = code
  }
}

export class SyncOfflineError extends Error {
  readonly code = 'offline' as const

  constructor(message = 'offline') {
    super(message)
    this.name = 'SyncOfflineError'
  }
}

export class SyncVaultExistsError extends Error {
  readonly code = 'vault_exists' as const

  constructor(message = 'An active vault already exists on the server') {
    super(message)
    this.name = 'SyncVaultExistsError'
  }
}

export class SyncVaultResetError extends Error {
  readonly code = 'vault_reset' as const

  constructor(message = 'The active vault has changed') {
    super(message)
    this.name = 'SyncVaultResetError'
  }
}

export class SyncChainError extends Error {
  readonly code = 'chain_break' as const

  constructor(message: string) {
    super(message)
    this.name = 'SyncChainError'
  }
}

export class SyncDecryptError extends Error {
  readonly code = 'decrypt_failed' as const

  constructor(message = 'could not decrypt sync op') {
    super(message)
    this.name = 'SyncDecryptError'
  }
}

export function isOfflineError(error: unknown): boolean {
  return (
    error instanceof SyncOfflineError || (error instanceof SyncRequestError && error.status === 0)
  )
}
