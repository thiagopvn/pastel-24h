CREATE TABLE `collaborator_consumptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`collaborator_user_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price_snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collaborator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);