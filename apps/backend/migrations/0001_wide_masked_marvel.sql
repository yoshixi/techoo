CREATE TABLE `note_task_conversions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX `calendars_user_id_provider_type_provider_calendar_id_unique`;--> statement-breakpoint
ALTER TABLE `calendars` ADD `provider_account_id` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `calendars_user_id_provider_type_provider_account_id_provider_calendar_id_unique` ON `calendars` (`user_id`,`provider_type`,`provider_account_id`,`provider_calendar_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `provider_email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_id_account_id_unique` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
ALTER TABLE `calendar_watch_channels` ADD `provider_account_id` text NOT NULL;