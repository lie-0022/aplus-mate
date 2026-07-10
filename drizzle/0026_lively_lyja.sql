CREATE TABLE `timetable_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timetableId` int NOT NULL,
	`userId` int NOT NULL,
	`content` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timetable_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timetable_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timetableId` int NOT NULL,
	`courseId` int,
	`title` varchar(100) NOT NULL,
	`professor` varchar(100),
	`dayOfWeek` enum('월','화','수','목','금','토','일'),
	`startPeriod` int,
	`endPeriod` int,
	`room` varchar(60),
	`cyber` boolean NOT NULL DEFAULT false,
	CONSTRAINT `timetable_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timetables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`semester` varchar(20) NOT NULL,
	`title` varchar(100) NOT NULL,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `timetables_id` PRIMARY KEY(`id`)
);
