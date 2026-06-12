CREATE TABLE `team_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`createdBy` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`dueAt` timestamp NOT NULL,
	`isDone` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `team_matches` ADD `requesterRole` enum('mentor','mentee');--> statement-breakpoint
ALTER TABLE `team_members` ADD `role` enum('member','mentor','mentee') DEFAULT 'member' NOT NULL;