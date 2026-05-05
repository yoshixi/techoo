import { getJwt, clearAuthState } from '../auth'
import { ApiRequestError } from './ApiRequestError'
import { API_BASE_URL } from './baseUrl'
import { reportApiFailure } from '../showApiError'

export { API_BASE_URL } from './baseUrl'

export interface CustomRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  params?: Record<string, string | number | boolean | null | undefined | string[] | number[]>
  data?: unknown
  headers?: Record<string, string>
  responseType?: 'json' | 'text'
}

/**
 * Custom HTTP client for React Native
 * This function will be used by the generated API client
 */
export const customInstance = async <T>(config: CustomRequestConfig): Promise<T> => {
  try {
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
    }

    // Add JWT authorization header
    const jwt = await getJwt()
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`
    }

    const requestConfig: RequestInit = {
      method: config.method || 'GET',
      headers,
      body: config.data ? JSON.stringify(config.data) : undefined,
    }

    const response = await fetch(url.toString(), requestConfig)

    // Handle 401 (JWT expired AND refresh also failed)
    if (response.status === 401) {
      await clearAuthState()
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new ApiRequestError(
        response.status,
        errorText?.trim() ? errorText : (response.statusText || null)
      )
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    }

    return (await response.text()) as unknown as T
  } catch (err) {
    reportApiFailure(err)
    throw err
  }
}

export default customInstance
