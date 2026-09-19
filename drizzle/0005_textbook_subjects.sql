ALTER TABLE `textbook_titles` ADD `subject_id` text;--> statement-breakpoint
ALTER TABLE `user_textbooks` ADD `subject_id` text DEFAULT 'my-materials' NOT NULL;