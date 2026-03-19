export function requireEnv(
  value: string | undefined,
  name: string,
  isProduction: boolean
): string {
  if (!value || value.trim() === "") {
    const message = `${name} is required`
    if (isProduction) {
      throw new Error(message)
    }
    console.error(message)
    return ""
  }
  return value.trim()
}
