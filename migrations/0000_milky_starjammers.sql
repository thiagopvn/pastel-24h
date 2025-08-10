CREATE TABLE `cash_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` text NOT NULL,
	`reason` text NOT NULL,
	`before_amount` text NOT NULL,
	`after_amount` text NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.304Z"',
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT '"2025-08-10T02:24:51.303Z"'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `config_key_unique` ON `config` (`key`);--> statement-breakpoint
CREATE TABLE `corrections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`correction_type` text NOT NULL,
	`shift_record_id` integer,
	`product_id` integer,
	`field_name` text,
	`payment_method` text,
	`cash_type` text,
	`original_value` text NOT NULL,
	`corrected_value` text NOT NULL,
	`reason` text NOT NULL,
	`evidence_url` text,
	`applied_at` integer DEFAULT '"2025-08-10T02:24:51.304Z"',
	`revoked_at` integer,
	`revoked_by_user_id` integer,
	`revoke_reason` text,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_record_id`) REFERENCES `shift_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pix_rate` text DEFAULT '0.00' NOT NULL,
	`stone_card_rate` text DEFAULT '3.50' NOT NULL,
	`stone_voucher_rate` text DEFAULT '2.50' NOT NULL,
	`pagbank_card_rate` text DEFAULT '3.20' NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.303Z"',
	`updated_at` integer DEFAULT '"2025-08-10T02:24:51.303Z"'
);
--> statement-breakpoint
CREATE TABLE `payroll_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hourly_rate` text DEFAULT '12.50' NOT NULL,
	`food_benefit` text DEFAULT '25.00' NOT NULL,
	`consumption_discount` integer DEFAULT 50 NOT NULL,
	`transport_rates` text DEFAULT '{"bus":8.8,"van":12,"app":15}' NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.303Z"',
	`updated_at` integer DEFAULT '"2025-08-10T02:24:51.304Z"'
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` text NOT NULL,
	`min_stock` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.302Z"'
);
--> statement-breakpoint
CREATE TABLE `shift_collaborators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`hours_worked` text DEFAULT '0.00',
	`internal_consumption` text DEFAULT '0.00',
	`added_at` integer DEFAULT '"2025-08-10T02:24:51.303Z"',
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shift_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`cash` text DEFAULT '0',
	`pix` text DEFAULT '0',
	`stone_card` text DEFAULT '0',
	`stone_voucher` text DEFAULT '0',
	`pagbank_card` text DEFAULT '0',
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shift_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`entry_qty` integer DEFAULT 0,
	`arrival_qty` integer DEFAULT 0,
	`leftover_qty` integer DEFAULT 0,
	`discard_qty` integer DEFAULT 0,
	`consumed_qty` integer DEFAULT 0,
	`sold_qty` integer DEFAULT 0,
	`price_snapshot` text NOT NULL,
	`item_total` text NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shift_signatures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`signed_at` integer NOT NULL,
	`ip_address` text,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shift_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`last_shift_id` integer,
	`carry_cash` text NOT NULL,
	`carry_coins` text NOT NULL,
	`carry_products` text,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.304Z"',
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`initial_cash` text NOT NULL,
	`initial_coins` text DEFAULT '0',
	`final_cash` text,
	`final_coins` text,
	`gas_exchange` integer DEFAULT false,
	`notes` text,
	`cash_divergence` text,
	`closed_by` integer,
	`total_sales` text,
	`status` text DEFAULT 'open' NOT NULL,
	`expected_cash` text,
	`counted_cash` text,
	`counted_coins` text,
	`inherited_from_shift_id` integer,
	`temp_final_cash` text,
	`temp_final_coins` text,
	`temp_gas_exchange` integer DEFAULT false,
	`counted_final_cash` text,
	`counted_final_coins` text,
	`envelope_cash` text,
	`envelope_coins` text,
	`cash_for_next_shift` text,
	`coins_for_next_shift` text,
	`opening_discrepancy` text,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.303Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `timeline` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.304Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transport_modes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`round_trip_price` text NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.302Z"',
	`updated_at` integer DEFAULT '"2025-08-10T02:24:51.302Z"'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transport_modes_name_unique` ON `transport_modes` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`transport_type` text,
	`transport_mode_id` integer,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.301Z"',
	FOREIGN KEY (`transport_mode_id`) REFERENCES `transport_modes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `weekly_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` integer NOT NULL,
	`week_end` integer NOT NULL,
	`hourly_rate` text NOT NULL,
	`food_benefit` text DEFAULT '0',
	`consumption_discount` integer DEFAULT 50,
	`transport_rates` text,
	`employee_data` text,
	`created_at` integer DEFAULT '"2025-08-10T02:24:51.303Z"'
);
