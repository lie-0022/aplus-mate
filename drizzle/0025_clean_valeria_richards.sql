CREATE TABLE `user_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(100) NOT NULL,
	`dayOfWeek` enum('월','화','수','목','금','토','일') NOT NULL,
	`startPeriod` int NOT NULL,
	`endPeriod` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_schedules_id` PRIMARY KEY(`id`)
);
