CREATE TABLE `consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`consentType` enum('signup','evaluation') NOT NULL,
	`consentVersion` varchar(20) NOT NULL,
	`agreedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consents_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_consent` UNIQUE(`userId`,`consentType`,`consentVersion`)
);
