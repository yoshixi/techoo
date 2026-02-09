import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { createUser } from '../core/users.db';
import { usersTable } from './schema/schema';
import { createSqliteLibsqlTestContext, type SqliteLibsqlTestContext } from './tests/sqliteLibsqlTestUtils';

describe('createUser', () => {
    let ctx: SqliteLibsqlTestContext | undefined;

    const getCtx = () => {
        if (!ctx) {
            throw new Error('SQLite test context has not been initialized');
        }
        return ctx;
    };

    beforeAll(async () => {
        ctx = await createSqliteLibsqlTestContext();
    });

    afterAll(async () => {
        if (ctx) {
            await ctx.reset();
        }
    });

    beforeEach(async () => {
        if (ctx) {
            await ctx.reset();
        }
    });

    it('creates a user row in the local SQLite file', async () => {
        const context = getCtx();
        const created = await createUser(context.db, 'Alice', 'alice@example.com');

        expect(created).toMatchObject({
            name: 'Alice',
            email: 'alice@example.com',
        });
        expect(created?.id).toBeTruthy();

        const rows = await context.db.select().from(usersTable).where(eq(usersTable.name, 'Alice'));

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: created?.id,
            name: 'Alice',
            email: 'alice@example.com',
        });
    });

    it('rejects blank names', async () => {
        const context = getCtx();
        await expect(createUser(context.db, '   ', 'blank@example.com')).rejects.toThrow('Name is required');
    });
});
