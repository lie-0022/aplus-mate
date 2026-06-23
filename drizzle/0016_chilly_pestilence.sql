CREATE TABLE `recruitments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`authorId` int NOT NULL,
	`teamId` int,
	`matchType` enum('project','study','mentoring') NOT NULL DEFAULT 'project',
	`authorRole` enum('mentor','mentee'),
	`title` varchar(200) NOT NULL,
	`description` text,
	`desiredSkills` text,
	`neededCount` int NOT NULL DEFAULT 1,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `recruitments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `team_matches` ADD `message` text;--> statement-breakpoint
ALTER TABLE `team_matches` ADD `recruitmentId` int;