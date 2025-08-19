-- Criar tabela com nome antigo para compatibilidade
CREATE TABLE IF NOT EXISTS `collaborator_consumption` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`collaborator_id` integer NOT NULL,
	`hours_worked` real DEFAULT 0 NOT NULL,
	`beverages_value` real DEFAULT 0 NOT NULL,
	`pastries_value` real DEFAULT 0 NOT NULL,
	`water_quantity` integer DEFAULT 0 NOT NULL,
	`consumed_products` text DEFAULT '[]',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collaborator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

-- Criar tabela com nome correto do schema (collaborator_consumptions)
CREATE TABLE IF NOT EXISTS `collaborator_consumptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`collaborator_user_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL DEFAULT 1,
	`price_snapshot` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collaborator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);