import { getJwt } from '../auth-tokens'

// API Configuration
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'}/api`

export interface CustomRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  params?: Record<string, string | number | boolean | null | undefined | Array<string | number>>
  data?: unknown
  headers?: Record<string, string>
  responseType?: 'json' | 'text'
}

/**
 * Custom HTTP client for Electron renderer process
 * This function will be used by the generated API client
 */
export const customInstance = async <T>(config: CustomRequestConfig): Promise<T> => {
  return requestWithAuthRetry<T>(config, false)
}

async function requestWithAuthRetry<T>(config: CustomRequestConfig, retried: boolean): Promise<T> {
  const url = new URL(config.url, API_BASE_URL)
  if (config.params) {
    Object.entries(config.params).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          url.searchParams.append(key, String(entry))
        })
        return
      }
      url.searchParams.set(key, String(value))
    })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...config.headers
  }

  const jwt = await getJwt()
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`
  }

  const requestConfig: RequestInit = {
    method: config.method || 'GET',
    headers,
    body: config.data ? JSON.stringify(config.data) : undefined
  }

  const response = await fetch(url.toString(), requestConfig)

  // JWT middleware 401s when the access token is expired. Google Calendar
  // routes also return 401 when *Google* tokens expire. Always try one
  // session→JWT refresh before giving up; never wipe the Techoo session on
  // a 401 that is not from `/api/token`.
  if (response.status === 401 && !retried) {
    const refreshed = await getJwt({ forceRefresh: true })
    if (refreshed) {
      return requestWithAuthRetry<T>(config, true)
    }
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json()
  }

  return (await response.text()) as unknown as T
}

export default customInstance
