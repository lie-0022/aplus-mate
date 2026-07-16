CREATE TABLE `course_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_course_favorite` UNIQUE(`userId`,`courseId`)
);
