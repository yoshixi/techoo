import { z } from '@hono/zod-openapi'

// UUID validation regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Helper schema for UUID validation with better error handling
export const UUIDSchema = z.string().regex(UUID_REGEX, { message: 'Invalid UUID format' }).openapi({
  description: 'UUID v4 format',
  example: '01234567-89ab-cdef-0123-456789abcdef',
})

// Alternative: Use the built-in uuid() method with explicit typing
export const UUIDSchemaBuiltIn = z.string().uuid().openapi({
  description: 'UUID format',
  example: '01234567-89ab-cdef-0123-456789abcdef',
})

// Export the preferred UUID schema (you can switch between them)
export { UUIDSchemaBuiltIn as UUIDSchemaFinal }