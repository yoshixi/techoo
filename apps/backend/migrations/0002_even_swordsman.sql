CREATE TABLE `oauth_exchange_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code_hash` text NOT NULL,
	`session_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_exchange_codes_code_hash_unique` ON `oauth_exchange_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `oauth_exchange_codes_expires_at_idx` ON `oauth_exchange_codes` (`expires_at`);