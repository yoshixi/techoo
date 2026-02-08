import { usersTable } from '../db/schema/schema';
import { type DB } from './common.db';
import { validateRequiredString } from './common.core';

/**
 * Creates a new user in the database.
 * @param db - Database instance
 * @param name - The name of the user
 * @param email - The email of the user
 * @returns The created user row
 */
export async function createUser(db: DB, name: string, email: string) {
  const validatedName = validateRequiredString(name, 'Name');

  const [createdUser] = await db
    .insert(usersTable)
    .values({
      name: validatedName,
      email,
    })
    .returning();
  return createdUser;
}
