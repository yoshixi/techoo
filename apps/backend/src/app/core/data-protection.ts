import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto'
import { getEnv } from './env'

function getProtectionKey(): string {
  return getEnv().BETTER_AUTH_SECRET
}

export async function protectSensitiveValue(value: string): Promise<string> {
  return symmetricEncrypt({
    key: getProtectionKey(),
    data: value
  })
}

export async function readProtectedValue(value: string): Promise<string> {
  return symmetricDecrypt({
    key: getProtectionKey(),
    data: value
  })
}

// Backward-compatible fallback for rows created before encryption was enabled.
export async function readPossiblyProtectedValue(value: string): Promise<string> {
  try {
    return await readProtectedValue(value)
  } catch {
    return value
  }
}
