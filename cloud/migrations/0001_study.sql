CREATE TABLE `responses` (
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected` text NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`answered_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `question_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`question_ids` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer
);

CREATE INDEX `idx_sessions_user_started` ON `sessions` (`user_id`,`started_at`);
CREATE TABLE `vocabulary` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`word` text NOT NULL,
	`word_key` text NOT NULL,
	`kind` text DEFAULT 'term' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`example` text DEFAULT '' NOT NULL,
	`question_id` text,
	`session_id` text,
	`subject_id` text,
	`source_label` text DEFAULT '' NOT NULL,
	`stage` integer DEFAULT 0 NOT NULL,
	`next_review` text NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`last_reviewed_at` integer,
	`last_reviewed_date` text,
	`queue_date` text,
	`queue_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX `idx_vocabulary_user_word` ON `vocabulary` (`user_id`,`word_key`);
CREATE INDEX `idx_vocabulary_user_due` ON `vocabulary` (`user_id`,`next_review`);
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

CREATE INDEX `idx_textbook_annotations_user_book_page` ON `textbook_annotations` (`user_id`,`book_id`,`page`);
CREATE INDEX `idx_textbook_annotations_user_updated` ON `textbook_annotations` (`user_id`,`updated_at`);
CREATE TABLE `textbook_titles` (
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`)
);

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

CREATE INDEX `idx_user_textbooks_user_created` ON `user_textbooks` (`user_id`,`created_at`);
PRAGMA optimize;

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

CREATE INDEX `idx_textbook_bookmarks_user_updated` ON `textbook_bookmarks` (`user_id`,`updated_at`);
ALTER TABLE `textbook_titles` ADD `subject_id` text;
ALTER TABLE `user_textbooks` ADD `subject_id` text DEFAULT 'my-materials' NOT NULL;