import { usersTable, type SelectUser } from '../db/schema/schema';
import { createId, type DB } from './common.db';
import { validateRequiredString } from './common.core';

/**
 * Creates a new user in the database.
 * @param db - Database instance
 * @param name - The name of the user
 * @returns The created user row
 */
export async function createUser(db: DB, name: string) {
  const validatedName = validateRequiredString(name, 'Name');
  
  const userId = createId();
  const [createdUser] = await db
    .insert(usersTable)
    .values({
      id: userId,
      name: validatedName,
    })
    .returning();
  return createdUser;
}