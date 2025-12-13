// Shared function (no database access functions)
// This file contains utility functions that don't require database access

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString()
}

export function parseISOToUnixTimestamp(isoString: string): number {
  return Math.floor(new Date(isoString).getTime() / 1000)
}

export function getCurrentUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

export function validateRequiredString(value: string | undefined | null, fieldName: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`${fieldName} is required`)
  }
  return value.trim()
}