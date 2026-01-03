
import { usersTable } from './schema/schema';
import { v7 as uuidv7 } from 'uuid';
import { type DB } from './common';
export async function createUser(db: DB, name: string) {
  // Validate name is not blank
  if (!name || name.trim() === '') {
    throw new Error('Name is required');
  }

  // Generate UUID v7 and use as 16-byte buffer
  const userId = uuidv7();
  const [createdUser] = await db
    .insert(usersTable)
    .values({
      id: userId,
      name: name.trim(),
    })
    .returning();
  return createdUser;
}
