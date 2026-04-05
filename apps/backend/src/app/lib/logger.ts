import pino from 'pino'
import type { Logger } from 'pino'

export type { Logger } from 'pino'

// Lazy-initialise so pino is not created at module (global) scope.
// CF Workers forbid I/O (including console.log) outside handlers.
let _logger: Logger | undefined

function getLogger(): Logger {
  if (!_logger) {
    _logger = pino({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      timestamp: pino.stdTimeFunctions.isoTime,
      serializers: {
        err(err: unknown) {
          if (err instanceof Error) {
            return {
              type: err.constructor.name,
              message: err.message,
              stack: err.stack,
              ...(err.cause ? { cause: String(err.cause) } : {}),
            }
          }
          return err
        },
      },
      browser: {
        serialize: true,
        write: (o: object) => {
          const obj = o as Record<string, unknown>
          // Pino browser mode emits numeric levels; convert to labels.
          const LEVEL_LABELS: Record<number, string> = {
            10: 'trace', 20: 'debug', 30: 'info',
            40: 'warn', 50: 'error', 60: 'fatal',
          }
          if (typeof obj.level === 'number') {
            obj.level = LEVEL_LABELS[obj.level] ?? String(obj.level)
          }
          console.log(JSON.stringify(obj))
        },
      },
    })
  }
  return _logger
}

export const rootLogger: Logger = new Proxy({} as Logger, {
  get(_target, prop, receiver) {
    return Reflect.get(getLogger(), prop, receiver)
  },
})
