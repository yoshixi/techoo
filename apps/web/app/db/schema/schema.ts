import { sqliteTable, text, integer, blob, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const usersTable = sqliteTable('users', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// User Auth Providers table - links external auth providers to users
export const userAuthProvidersTable = sqliteTable('user_auth_providers', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  userId: blob('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }).$type<string>(),
  provider: text('provider').notNull(),         // 'clerk', 'google', etc.
  providerId: text('provider_id').notNull(),    // External ID from provider
  email: text('email'),                         // Email from provider
  providerData: text('provider_data'),          // JSON blob for additional data (imageUrl, etc.)
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueProviderUser: unique().on(table.provider, table.providerId),
}));

// Tasks table
export const tasksTable = sqliteTable('tasks', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  userId: blob('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueAt: integer('due_at', { mode: 'number' }), // Unix timestamp
  startAt: integer('start_at', { mode: 'number' }), // Unix timestamp
  endAt: integer('end_at', { mode: 'number' }), // Unix timestamp
  completedAt: integer('completed_at', { mode: 'number' }), // Unix timestamp
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// TaskTimers table
export const taskTimersTable = sqliteTable('task_timers', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  taskId: blob('task_id').notNull().references(() => tasksTable.id, { onDelete: 'cascade' }).$type<string>(),
  startTime: integer('start_time', { mode: 'number' }).notNull(), // Unix timestamp (seconds)
  endTime: integer('end_time', { mode: 'number' }), // Unix timestamp (seconds, optional)
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// TaskComments table
export const taskCommentsTable = sqliteTable('task_comments', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  taskId: blob('task_id').notNull().references(() => tasksTable.id, { onDelete: 'cascade' }).$type<string>(),
  authorId: blob('author_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }).$type<string>(),
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// Tags table (user-scoped tags)
export const tagsTable = sqliteTable('tags', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  userId: blob('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueUserTag: unique().on(table.userId, table.name),
}));

// TaskTags junction table (many-to-many relationship between tasks and tags)
export const taskTagsTable = sqliteTable('task_tags', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  taskId: blob('task_id').notNull().references(() => tasksTable.id, { onDelete: 'cascade' }).$type<string>(),
  tagId: blob('tag_id').notNull().references(() => tagsTable.id, { onDelete: 'cascade' }).$type<string>(),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueTaskTag: unique().on(table.taskId, table.tagId),
}));

// Indexes
export const userAuthProvidersUserIdIdx = index('user_auth_providers_user_id_idx').on(userAuthProvidersTable.userId);
export const tasksDueAtIdx = index('tasks_due_at_idx').on(tasksTable.dueAt);
export const taskTimersTaskIdIdx = index('task_timers_task_id_idx').on(taskTimersTable.taskId);
export const taskCommentsTaskIdCreatedAtIdx = index('task_comments_task_id_created_at_idx').on(taskCommentsTable.taskId, taskCommentsTable.createdAt);
export const tagsUserIdIdx = index('tags_user_id_idx').on(tagsTable.userId);
export const taskTagsTaskIdIdx = index('task_tags_task_id_idx').on(taskTagsTable.taskId);
export const taskTagsTagIdIdx = index('task_tags_tag_id_idx').on(taskTagsTable.tagId);

// OAuth Sessions table - stores PKCE sessions for OAuth flow
export const oauthSessionsTable = sqliteTable('oauth_sessions', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  state: text('state').notNull().unique(),     // Random string for CSRF protection
  codeVerifier: text('code_verifier').notNull(), // PKCE code_verifier
  redirectUri: text('redirect_uri').notNull(), // Client's callback URL
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(), // Unix timestamp
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

export const oauthSessionsStateIdx = index('oauth_sessions_state_idx').on(oauthSessionsTable.state);

// Type exports
export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertUserAuthProvider = typeof userAuthProvidersTable.$inferInsert;
export type SelectUserAuthProvider = typeof userAuthProvidersTable.$inferSelect;
export type InsertTask = typeof tasksTable.$inferInsert;
export type SelectTask = typeof tasksTable.$inferSelect;
export type InsertTaskTimer = typeof taskTimersTable.$inferInsert;
export type SelectTaskTimer = typeof taskTimersTable.$inferSelect;
export type InsertTaskComment = typeof taskCommentsTable.$inferInsert;
export type SelectTaskComment = typeof taskCommentsTable.$inferSelect;
export type InsertTag = typeof tagsTable.$inferInsert;
export type SelectTag = typeof tagsTable.$inferSelect;
export type InsertTaskTag = typeof taskTagsTable.$inferInsert;
export type SelectTaskTag = typeof taskTagsTable.$inferSelect;
export type InsertOAuthSession = typeof oauthSessionsTable.$inferInsert;
export type SelectOAuthSession = typeof oauthSessionsTable.$inferSelect;
