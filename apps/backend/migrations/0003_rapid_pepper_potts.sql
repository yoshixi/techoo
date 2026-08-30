ALTER TABLE `posts` ADD `parent_post_id` integer REFERENCES posts(id) ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_parent_post_id_idx` ON `posts` (`parent_post_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_user_parent_posted_at_idx` ON `posts` (`user_id`,`parent_post_id`,`posted_at`);