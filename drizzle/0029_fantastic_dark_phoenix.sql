CREATE TABLE `review_helpful` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_helpful_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_review_helpful` UNIQUE(`reviewId`,`userId`)
);
