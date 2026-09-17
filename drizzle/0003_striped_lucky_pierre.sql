CREATE TABLE `textbook_titles` (
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`)
);
--> statement-breakpoint
CREATE TABLE `user_textbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`original_name` text NOT NULL,
	`page_count` integer NOT NULL,
	`storage_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_user_textbooks_user_created` ON `user_textbooks` (`user_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
