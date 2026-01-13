CREATE TABLE `tags` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` blob NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_user_id_name_unique` ON `tags` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`id` blob PRIMARY KEY NOT NULL,
	`task_id` blob NOT NULL,
	`tag_id` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_tags_task_id_tag_id_unique` ON `task_tags` (`task_id`,`tag_id`);