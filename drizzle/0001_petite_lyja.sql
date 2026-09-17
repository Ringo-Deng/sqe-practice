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
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vocabulary_user_word` ON `vocabulary` (`user_id`,`word_key`);--> statement-breakpoint
CREATE INDEX `idx_vocabulary_user_due` ON `vocabulary` (`user_id`,`next_review`);