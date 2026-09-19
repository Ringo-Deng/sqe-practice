CREATE TABLE `textbook_bookmarks` (
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`page` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`, `page`)
);
--> statement-breakpoint
CREATE INDEX `idx_textbook_bookmarks_user_updated` ON `textbook_bookmarks` (`user_id`,`updated_at`);