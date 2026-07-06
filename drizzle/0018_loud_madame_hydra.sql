CREATE TABLE `course_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`hadTeamProject` boolean,
	`content` varchar(500),
	`semester` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_review_user_course` UNIQUE(`courseId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `teams` ADD `professorApprovedAt` timestamp;