CREATE TABLE `badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`badgeType` enum('promise','idea','deadline') NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_badge` UNIQUE(`userId`,`badgeType`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`professor` varchar(100) NOT NULL,
	`credits` int NOT NULL,
	`hasTeamProject` boolean NOT NULL DEFAULT false,
	`university` varchar(100) NOT NULL,
	`courseCode` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_course` UNIQUE(`name`,`professor`,`university`)
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`evaluatorId` int NOT NULL,
	`evaluateeId` int NOT NULL,
	`promiseScore` int NOT NULL,
	`ideaScore` int NOT NULL,
	`deadlineScore` int NOT NULL,
	`grade` enum('A+','A','B+','B','C+') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`content` text NOT NULL,
	`category` enum('족보','과제팁','후기','스터디') NOT NULL,
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requesterId` int NOT NULL,
	`receiverId` int NOT NULL,
	`courseId` int NOT NULL,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`userId` int NOT NULL,
	`hasEvaluated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int,
	`courseId` int NOT NULL,
	`name` varchar(100),
	`status` enum('active','completed') NOT NULL DEFAULT 'active',
	`evaluationStatus` enum('pending','in_progress','done') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`semester` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_course` UNIQUE(`userId`,`courseId`,`semester`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `university` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `year` int;--> statement-breakpoint
ALTER TABLE `users` ADD `skillTags` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `users` ADD `kakaoOpenChatUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `profileCompleted` boolean DEFAULT false NOT NULL;