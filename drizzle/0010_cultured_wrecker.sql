CREATE TABLE `course_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`createdBy` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`milestoneId` int NOT NULL,
	`teamId` int NOT NULL,
	`submittedBy` int NOT NULL,
	`url` varchar(1000) NOT NULL,
	`note` text,
	`reviewedAt` timestamp,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_team_submission` UNIQUE(`milestoneId`,`teamId`)
);
