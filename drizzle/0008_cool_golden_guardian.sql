CREATE TABLE `course_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`professorId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `survey_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`type` enum('scale','choice') NOT NULL,
	`text` varchar(500) NOT NULL,
	`options` json,
	CONSTRAINT `survey_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `survey_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`questionId` int NOT NULL,
	`userId` int NOT NULL,
	`value` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_survey_response` UNIQUE(`questionId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `surveys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`professorId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `surveys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','professor','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `courses` ADD `professorId` int;