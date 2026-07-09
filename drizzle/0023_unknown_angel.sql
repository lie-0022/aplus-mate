CREATE TABLE `course_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`dayOfWeek` enum('월','화','수','목','금','토','일'),
	`period` int,
	`cyber` boolean NOT NULL DEFAULT false,
	`room` varchar(60),
	CONSTRAINT `course_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `courses` DROP INDEX `uniq_course`;--> statement-breakpoint
ALTER TABLE `courses` MODIFY COLUMN `professor` varchar(100);--> statement-breakpoint
ALTER TABLE `courses` ADD `semester` varchar(20);--> statement-breakpoint
ALTER TABLE `courses` ADD `courseGroupId` varchar(8);--> statement-breakpoint
ALTER TABLE `courses` ADD `section` varchar(4);--> statement-breakpoint
ALTER TABLE `courses` ADD `department` varchar(100);--> statement-breakpoint
ALTER TABLE `courses` ADD `category` enum('교양','전공','교직','기타');--> statement-breakpoint
ALTER TABLE `courses` ADD `subType` varchar(50);--> statement-breakpoint
ALTER TABLE `courses` ADD `hours` int;--> statement-breakpoint
ALTER TABLE `courses` ADD `capacity` int;--> statement-breakpoint
ALTER TABLE `courses` ADD `competencies` json;--> statement-breakpoint
ALTER TABLE `courses` ADD `note` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `campus` varchar(50);--> statement-breakpoint
ALTER TABLE `courses` ADD `sourceKey` varchar(40);--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `uniq_source_key` UNIQUE(`sourceKey`);