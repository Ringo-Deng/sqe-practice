CREATE TABLE `textbook_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`page` integer NOT NULL,
	`quote` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'yellow' NOT NULL,
	`rects` text NOT NULL,
	`source_question_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_textbook_annotations_user_book_page` ON `textbook_annotations` (`user_id`,`book_id`,`page`);--> statement-breakpoint
CREATE INDEX `idx_textbook_annotations_user_updated` ON `textbook_annotations` (`user_id`,`updated_at`);