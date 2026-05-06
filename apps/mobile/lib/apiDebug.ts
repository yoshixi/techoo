import Constants from 'expo-constants'

/** True when `DEBUG` is set when bundling (`pnpm run dev`) or in `.env.local`. */
export function isApiDebugEnabled(): boolean {
  const raw = Constants.expoConfig?.extra?.apiDebug
  if (raw === true) return true
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim()
    return s === 'true' || s === '1' || s === 'yes'
  }
  return false
}
