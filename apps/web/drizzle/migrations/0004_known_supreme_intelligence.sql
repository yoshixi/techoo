DROP INDEX `task_comments_task_id_created_at_idx`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `end_at` integer;