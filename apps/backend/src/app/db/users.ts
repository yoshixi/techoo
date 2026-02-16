
import { usersTable } from './schema/schema';
import { type DB } from './common';
export async function createUser(db: DB, name: string, email: string) {
  // Validate name is not blank
  if (!name || name.trim() === '') {
    throw new Error('Name is required');
  }

  const [createdUser] = await db
    .insert(usersTable)
    .values({
      name: name.trim(),
      email,
    })
    .returning();
  return createdUser;
}
