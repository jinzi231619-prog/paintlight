CREATE TABLE `paintings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`metadata` text NOT NULL,
	`object_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_paintings_owner_created` ON `paintings` (`owner`,`created_at`);