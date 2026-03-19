import { z } from '@hono/zod-openapi'

// Shared function (no database access functions)
// This file contains utility functions that don't require database access

// Helper schema for numeric IDs stored in SQLite
export const IdSchema = z.coerce.number().int().positive().openapi({
  description: 'Numeric ID',
  example: 1,
})

export function formatTimestamp(timestamp: Date): string {
  const date = timestamp
  if (Number.isNaN(date.getTime())) {
    console.warn('Invalid timestamp value after conversion:', timestamp)
    return new Date(0).toISOString()
  }

  return date.toISOString()
}

export function parseISOToDate(isoString: string): Date {
  return new Date(isoString)
}

export function getCurrentTimestamp(): Date {
  return new Date()
}

export function validateRequiredString(value: string | undefined | null, fieldName: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`${fieldName} is required`)
  }
  return value.trim()
}

// Common error response model
export const ErrorResponseModel = z.object({
  error: z.string().openapi({
    description: 'Error message describing what went wrong',
    example: 'Task not found'
  }),
  code: z.string().optional().openapi({
    description: 'Optional error code',
    example: 'TASK_NOT_FOUND'
  })
}).openapi('ErrorResponse')

// Health check response model
export const HealthResponseModel = z.object({
  status: z.string().openapi({
    description: 'Health status',
    example: 'ok'
  }),
  message: z.string().openapi({
    description: 'Health status message',
    example: 'Techoo API is running'
  }),
  timestamp: z.iso.datetime().openapi({
    description: 'Current timestamp',
    example: '2024-01-01T10:00:00.000Z'
  })
}).openapi('HealthResponse')

// Export types
export type ErrorResponse = z.infer<typeof ErrorResponseModel>
export type HealthResponse = z.infer<typeof HealthResponseModel>
