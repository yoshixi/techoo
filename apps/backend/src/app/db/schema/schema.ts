import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const usersTable = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
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

// Tasks table
export const tasksTable = sqliteTable('tasks', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueAt: integer('due_at', { mode: 'timestamp' }),
  startAt: integer('start_at', { mode: 'timestamp' }),
  endAt: integer('end_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// TaskTimers table
export const taskTimersTable = sqliteTable('task_timers', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  taskId: integer('task_id', { mode: 'number' }).notNull().references(() => tasksTable.id, { onDelete: 'cascade' }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// TaskComments table
export const taskCommentsTable = sqliteTable('task_comments', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  taskId: integer('task_id', { mode: 'number' }).notNull().references(() => tasksTable.id, { onDelete: 'cascade' }),
  authorId: integer('author_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Tags table (user-scoped tags)
export const tagsTable = sqliteTable('tags', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueUserTag: unique().on(table.userId, table.name),
}));

// TaskTags junction table (many-to-many relationship between tasks and tags)
export const taskTagsTable = sqliteTable('task_tags', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  taskId: integer('task_id', { mode: 'number' }).notNull().references(() => tasksTable.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id', { mode: 'number' }).notNull().references(() => tagsTable.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueTaskTag: unique().on(table.taskId, table.tagId),
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

// Indexes
export const tasksDueAtIdx = index('tasks_due_at_idx').on(tasksTable.dueAt);
export const taskTimersTaskIdIdx = index('task_timers_task_id_idx').on(taskTimersTable.taskId);
export const taskCommentsTaskIdCreatedAtIdx = index('task_comments_task_id_created_at_idx').on(taskCommentsTable.taskId, taskCommentsTable.createdAt);
export const tagsUserIdIdx = index('tags_user_id_idx').on(tagsTable.userId);
export const taskTagsTaskIdIdx = index('task_tags_task_id_idx').on(taskTagsTable.taskId);
export const taskTagsTagIdIdx = index('task_tags_tag_id_idx').on(taskTagsTable.tagId);
export const calendarsUserIdIdx = index('calendars_user_id_idx').on(calendarsTable.userId);
export const calendarEventsCalendarIdIdx = index('calendar_events_calendar_id_idx').on(calendarEventsTable.calendarId);
export const calendarEventsStartAtIdx = index('calendar_events_start_at_idx').on(calendarEventsTable.startAt);
export const calendarEventsEndAtIdx = index('calendar_events_end_at_idx').on(calendarEventsTable.endAt);
export const calendarWatchChannelsCalendarIdIdx = index('calendar_watch_channels_calendar_id_idx').on(calendarWatchChannelsTable.calendarId);
export const calendarWatchChannelsChannelIdIdx = index('calendar_watch_channels_channel_id_idx').on(calendarWatchChannelsTable.channelId);
export const calendarWatchChannelsExpiresAtIdx = index('calendar_watch_channels_expires_at_idx').on(calendarWatchChannelsTable.expiresAt);

// Type exports
export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
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
export type InsertSession = typeof sessionsTable.$inferInsert;
export type SelectSession = typeof sessionsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;
export type SelectAccount = typeof accountsTable.$inferSelect;
export type InsertVerification = typeof verificationsTable.$inferInsert;
export type SelectVerification = typeof verificationsTable.$inferSelect;
export type InsertCalendar = typeof calendarsTable.$inferInsert;
export type SelectCalendar = typeof calendarsTable.$inferSelect;
export type InsertCalendarEvent = typeof calendarEventsTable.$inferInsert;
export type SelectCalendarEvent = typeof calendarEventsTable.$inferSelect;
export type InsertCalendarWatchChannel = typeof calendarWatchChannelsTable.$inferInsert;
export type SelectCalendarWatchChannel = typeof calendarWatchChannelsTable.$inferSelect;
