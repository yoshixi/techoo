CREATE TABLE `task_timers` (
	`id` blob PRIMARY KEY NOT NULL,
	`task_id` blob NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` blob NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` blob PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
