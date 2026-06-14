CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`targetType` enum('post','comment','user') NOT NULL,
	`targetId` int NOT NULL,
	`reason` enum('abuse','spam','privacy','etc') NOT NULL,
	`detail` text,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_report` UNIQUE(`reporterId`,`targetType`,`targetId`)
);
