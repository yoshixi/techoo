/** Thrown by `customInstance` when the API returns a non-OK status (except 401, which clears auth separately). */
export class ApiRequestError extends Error {
  readonly status: number
  /** Raw response body, if any — for logging/debug only; do not show in UI. */
  readonly body: string | null

  constructor(status: number, body: string | null) {
    super(`HTTP ${status}`)
    this.name = 'ApiRequestError'
    this.status = status
    this.body = body
  }
}

export function isApiRequestError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError
}
