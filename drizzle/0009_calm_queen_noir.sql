ALTER TABLE `survey_questions` MODIFY COLUMN `type` enum('scale','choice','text') NOT NULL;--> statement-breakpoint
ALTER TABLE `survey_responses` MODIFY COLUMN `value` int;--> statement-breakpoint
ALTER TABLE `survey_responses` ADD `textValue` text;