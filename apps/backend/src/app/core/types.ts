/** Discriminated union for operations that can fail with a reason. */
export type Result<T = void, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/** Shorthand constructors */
export const Ok = <T = void>(value?: T): Result<T> =>
  ({ ok: true, value: value as T })

export const Err = <E = string>(error: E): Result<never, E> =>
  ({ ok: false, error })
