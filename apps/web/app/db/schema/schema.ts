import { sqliteTable, text, integer, blob, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const usersTable = sqliteTable('users', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  name: text('name').notNull(),
});

// Tasks table
export const tasksTable = sqliteTable('tasks', {
  id: blob('id').primaryKey().$type<string>(), // UUID v7 (16 bytes)
  userId: blob('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueAt: integer('due_at', { mode: 'number' }), // Unix timestamp
  startAt: integer('start_at', { mode: 'number' }), // Unix timestamp
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

// Indexes
export const tasksDueAtIdx = index('tasks_due_at_idx').on(tasksTable.dueAt);
export const taskTimersTaskIdIdx = index('task_timers_task_id_idx').on(taskTimersTable.taskId);

// Type exports
export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertTask = typeof tasksTable.$inferInsert;
export type SelectTask = typeof tasksTable.$inferSelect;
export type InsertTaskTimer = typeof taskTimersTable.$inferInsert;
export type SelectTaskTimer = typeof taskTimersTable.$inferSelect;
