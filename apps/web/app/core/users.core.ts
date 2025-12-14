import { z } from '@hono/zod-openapi'
import { UUIDSchema } from './tasks.core'

// User model
export const UserModel = z.object({
  id: UUIDSchema.openapi({
    description: 'Unique identifier for the user'
  }),
  name: z.string().min(1).max(100).openapi({
    description: 'Name of the user',
    example: 'John Doe'
  })
}).openapi('User')

// Create user input model
export const CreateUserModel = z.object({
  name: z.string().min(1, 'Name is required').max(100).openapi({
    description: 'Name of the user',
    example: 'John Doe'
  })
}).openapi('CreateUser')

// User response model
export const UserResponseModel = z.object({
  user: UserModel
}).openapi('UserResponse')

// Export types
export type User = z.infer<typeof UserModel>
export type CreateUser = z.infer<typeof CreateUserModel>
export type UserResponse = z.infer<typeof UserResponseModel>

// Business logic functions can go here as well
// (keeping them separate from database schema)