ALTER TABLE `courses` ADD `inviteCode` varchar(8);--> statement-breakpoint
ALTER TABLE `courses` ADD `matchingDeadline` timestamp;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `uniq_invite_code` UNIQUE(`inviteCode`);