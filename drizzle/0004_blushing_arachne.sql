ALTER TABLE `team_matches` DROP INDEX `uniq_team_match_pending`;--> statement-breakpoint
ALTER TABLE `team_matches` ADD `matchType` enum('project','study','mentoring') DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `teamType` enum('project','study','mentoring') DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_matches` ADD CONSTRAINT `uniq_team_match_pending` UNIQUE(`requesterId`,`receiverId`,`courseId`,`matchType`,`status`);