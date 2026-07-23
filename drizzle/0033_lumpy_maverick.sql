CREATE TABLE `portfolio_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(100) NOT NULL,
	`summary` varchar(200),
	`role` varchar(50),
	`techTags` json DEFAULT ('[]'),
	`repoUrl` varchar(300),
	`demoUrl` varchar(300),
	`ghStars` int,
	`ghLanguage` varchar(40),
	`ghPushedAt` timestamp,
	`ghSyncedAt` timestamp,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `githubUsername` varchar(39);--> statement-breakpoint
ALTER TABLE `users` ADD `bio` varchar(200);