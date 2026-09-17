CREATE TABLE `responses` (
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected` text NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`answered_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `question_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_started` ON `sessions` (`user_id`,`started_at`);