CREATE TABLE `shift_collaborators_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`hours_worked` text DEFAULT '0.00',
	`added_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);