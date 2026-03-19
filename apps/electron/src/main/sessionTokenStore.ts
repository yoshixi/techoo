import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'

const SESSION_TOKEN_FILENAME = 'session_token.bin'

const getSessionTokenPath = () => path.join(app.getPath('userData'), SESSION_TOKEN_FILENAME)

const encryptToken = (token: string): Buffer => {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(token)
  }
  return Buffer.from(token, 'utf-8')
}

const decryptToken = (buffer: Buffer): string => {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(buffer)
  }
  return buffer.toString('utf-8')
}

export function readSessionToken(): string | null {
  const tokenPath = getSessionTokenPath()
  if (!fs.existsSync(tokenPath)) return null
  const encrypted = fs.readFileSync(tokenPath)
  return decryptToken(encrypted)
}

export function writeSessionToken(token: string): void {
  const tokenPath = getSessionTokenPath()
  const encrypted = encryptToken(token)
  fs.writeFileSync(tokenPath, encrypted, { mode: 0o600 })
}

export function clearSessionToken(): void {
  const tokenPath = getSessionTokenPath()
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath)
  }
}
