import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const usersTable = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  timezone: text('timezone'), // e.g. 'Asia/Tokyo'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Sessions table (better-auth)
export const sessionsTable = sqliteTable('sessions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: integer('user_id', { mode: 'number' }).notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Accounts table (better-auth)
export const accountsTable = sqliteTable('accounts', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: integer('user_id', { mode: 'number' }).notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  providerEmail: text('provider_email'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueProviderAccount: unique().on(table.providerId, table.accountId),
}));

// Verifications table (better-auth)
export const verificationsTable = sqliteTable('verifications', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// OAuth exchange codes (short-lived, single-use)
export const oauthExchangeCodesTable = sqliteTable('oauth_exchange_codes', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  codeHash: text('code_hash').notNull().unique(),
  sessionToken: text('session_token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  expiresAtIndex: index('oauth_exchange_codes_expires_at_idx').on(table.expiresAt),
}));

// Todos table
export const todosTable = sqliteTable('todos', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: integer('starts_at', { mode: 'number' }),
  endsAt: integer('ends_at', { mode: 'number' }),
  isAllDay: integer('is_all_day', { mode: 'number' }).notNull().default(0),
  done: integer('done', { mode: 'number' }).notNull().default(0),
  doneAt: integer('done_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// Posts table
export const postsTable = sqliteTable('posts', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  postedAt: integer('posted_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// Post-Events junction table (many-to-many)
export const postEventsTable = sqliteTable('post_events', {
  postId: integer('post_id', { mode: 'number' }).notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  eventId: integer('event_id', { mode: 'number' }).notNull().references(() => calendarEventsTable.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: unique().on(table.postId, table.eventId),
}));

// Post-Todos junction table (many-to-many)
export const postTodosTable = sqliteTable('post_todos', {
  postId: integer('post_id', { mode: 'number' }).notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  todoId: integer('todo_id', { mode: 'number' }).notNull().references(() => todosTable.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: unique().on(table.postId, table.todoId),
}));

// Post Favorites table (per-user star toggle)
export const postFavoritesTable = sqliteTable('post_favorites', {
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  postId: integer('post_id', { mode: 'number' }).notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  pk: unique().on(table.userId, table.postId),
}));

// Post Lists table (named collections owned by a user)
export const postListsTable = sqliteTable('post_lists', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// Post List Items junction table (many-to-many: lists ↔ posts)
export const postListItemsTable = sqliteTable('post_list_items', {
  listId: integer('list_id', { mode: 'number' }).notNull().references(() => postListsTable.id, { onDelete: 'cascade' }),
  postId: integer('post_id', { mode: 'number' }).notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  addedAt: integer('added_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  pk: unique().on(table.listId, table.postId),
}));

// Calendars table (provider-agnostic)
export const calendarsTable = sqliteTable('calendars', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  providerType: text('provider_type').notNull(), // 'google' | 'outlook' | 'apple'
  providerAccountId: text('provider_account_id').notNull(),
  providerCalendarId: text('provider_calendar_id').notNull(), // Provider's calendar ID
  name: text('name').notNull(), // Display name
  color: text('color'), // Calendar color
  isEnabled: integer('is_enabled', { mode: 'number' }).notNull().default(1), // Whether to sync this calendar
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueUserProviderCalendar: unique().on(
    table.userId,
    table.providerType,
    table.providerAccountId,
    table.providerCalendarId
  ),
}));

// Calendar Events table (provider-agnostic)
export const calendarEventsTable = sqliteTable('calendar_events', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  calendarId: integer('calendar_id', { mode: 'number' }).notNull().references(() => calendarsTable.id, { onDelete: 'cascade' }),
  providerType: text('provider_type').notNull(), // 'google' | 'outlook' | 'apple' (denormalized for queries)
  providerEventId: text('provider_event_id').notNull(), // Provider's event ID
  title: text('title').notNull(),
  description: text('description'),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  isAllDay: integer('is_all_day', { mode: 'number' }).notNull().default(0),
  location: text('location'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueCalendarEvent: unique().on(table.calendarId, table.providerEventId),
}));

// Calendar Watch Channels table (for push notifications)
export const calendarWatchChannelsTable = sqliteTable('calendar_watch_channels', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  calendarId: integer('calendar_id', { mode: 'number' }).notNull().references(() => calendarsTable.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull(), // UUID sent to Google for identifying the channel
  resourceId: text('resource_id').notNull(), // Resource ID returned by Google
  providerType: text('provider_type').notNull(), // 'google' | 'outlook' | 'apple'
  providerAccountId: text('provider_account_id').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token'), // Optional verification token
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueCalendarChannel: unique().on(table.calendarId, table.providerType),
}));

// Notes table
export const notesTable = sqliteTable('notes', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body'),
  pinned: integer('pinned', { mode: 'number' }).notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// Indexes — Todos
export const todosStartsAtIdx = index('todos_starts_at_idx').on(todosTable.startsAt);
export const todosUserIdDoneIdx = index('todos_user_id_done_idx').on(todosTable.userId, todosTable.done);

// Indexes — Posts
export const postsPostedAtIdx = index('posts_posted_at_idx').on(postsTable.postedAt);

// Indexes — Calendar (kept from previous schema)
export const calendarsUserIdIdx = index('calendars_user_id_idx').on(calendarsTable.userId);
export const calendarEventsCalendarIdIdx = index('calendar_events_calendar_id_idx').on(calendarEventsTable.calendarId);
export const calendarEventsStartAtIdx = index('calendar_events_start_at_idx').on(calendarEventsTable.startAt);
export const calendarEventsEndAtIdx = index('calendar_events_end_at_idx').on(calendarEventsTable.endAt);
export const calendarWatchChannelsCalendarIdIdx = index('calendar_watch_channels_calendar_id_idx').on(calendarWatchChannelsTable.calendarId);
export const calendarWatchChannelsChannelIdIdx = index('calendar_watch_channels_channel_id_idx').on(calendarWatchChannelsTable.channelId);
export const calendarWatchChannelsExpiresAtIdx = index('calendar_watch_channels_expires_at_idx').on(calendarWatchChannelsTable.expiresAt);

// Indexes — Notes
export const notesUserIdIdx = index('notes_user_id_idx').on(notesTable.userId);
export const notesUpdatedAtIdx = index('notes_updated_at_idx').on(notesTable.updatedAt);

// Type exports — Auth
export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;
export type SelectSession = typeof sessionsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;
export type SelectAccount = typeof accountsTable.$inferSelect;
export type InsertVerification = typeof verificationsTable.$inferInsert;
export type SelectVerification = typeof verificationsTable.$inferSelect;
export type InsertOauthExchangeCode = typeof oauthExchangeCodesTable.$inferInsert;
export type SelectOauthExchangeCode = typeof oauthExchangeCodesTable.$inferSelect;

// Type exports — Calendar
export type InsertCalendar = typeof calendarsTable.$inferInsert;
export type SelectCalendar = typeof calendarsTable.$inferSelect;
export type InsertCalendarEvent = typeof calendarEventsTable.$inferInsert;
export type SelectCalendarEvent = typeof calendarEventsTable.$inferSelect;
export type InsertCalendarWatchChannel = typeof calendarWatchChannelsTable.$inferInsert;
export type SelectCalendarWatchChannel = typeof calendarWatchChannelsTable.$inferSelect;

// Type exports — Domain
export type InsertTodo = typeof todosTable.$inferInsert;
export type SelectTodo = typeof todosTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
export type SelectPost = typeof postsTable.$inferSelect;
export type InsertPostEvent = typeof postEventsTable.$inferInsert;
export type SelectPostEvent = typeof postEventsTable.$inferSelect;
export type InsertPostTodo = typeof postTodosTable.$inferInsert;
export type SelectPostTodo = typeof postTodosTable.$inferSelect;
export type InsertNote = typeof notesTable.$inferInsert;
export type SelectNote = typeof notesTable.$inferSelect;
export type InsertPostFavorite = typeof postFavoritesTable.$inferInsert;
export type SelectPostFavorite = typeof postFavoritesTable.$inferSelect;
export type InsertPostList = typeof postListsTable.$inferInsert;
export type SelectPostList = typeof postListsTable.$inferSelect;
export type InsertPostListItem = typeof postListItemsTable.$inferInsert;
export type SelectPostListItem = typeof postListItemsTable.$inferSelect;
