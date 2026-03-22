import { getEnv } from '../../../core/env'

const DEFAULT_MOBILE_REDIRECT_URIS = [
  'techoo://auth-callback',
  'techoo://link-callback',
  'exp+techoo://auth-callback',
  'exp+techoo://link-callback'
]

const normalizeRedirectUri = (redirectUri: string) =>
  redirectUri.trim().replace(/\/$/, '')

export const getAllowedMobileRedirectUris = () => {
  const env = getEnv()
  const raw = env.MOBILE_REDIRECT_URIS
  if (!raw) return DEFAULT_MOBILE_REDIRECT_URIS
  return raw
    .split(',')
    .map((value) => normalizeRedirectUri(value))
    .filter(Boolean)
}

export const isAllowedMobileRedirectUri = (redirectUri: string) => {
  const normalized = normalizeRedirectUri(redirectUri)
  const allowed = getAllowedMobileRedirectUris()
  return allowed.includes(normalized)
}
