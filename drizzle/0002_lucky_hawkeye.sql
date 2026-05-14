ALTER TABLE `evaluations` ADD CONSTRAINT `uniq_evaluation` UNIQUE(`teamId`,`evaluatorId`,`evaluateeId`);--> statement-breakpoint
ALTER TABLE `team_matches` ADD CONSTRAINT `uniq_team_match_pending` UNIQUE(`requesterId`,`receiverId`,`courseId`,`status`);--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `uniq_team_member` UNIQUE(`teamId`,`userId`);--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `uniq_team_per_match` UNIQUE(`matchId`);