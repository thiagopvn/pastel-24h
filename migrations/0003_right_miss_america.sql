PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cash_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` text NOT NULL,
	`reason` text NOT NULL,
	`before_amount` text NOT NULL,
	`after_amount` text NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"',
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cash_adjustments`("id", "shift_id", "user_id", "type", "amount", "reason", "before_amount", "after_amount", "created_at") SELECT "id", "shift_id", "user_id", "type", "amount", "reason", "before_amount", "after_amount", "created_at" FROM `cash_adjustments`;--> statement-breakpoint
DROP TABLE `cash_adjustments`;--> statement-breakpoint
ALTER TABLE `__new_cash_adjustments` RENAME TO `cash_adjustments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"'
);
--> statement-breakpoint
INSERT INTO `__new_config`("id", "key", "value", "updated_at") SELECT "id", "key", "value", "updated_at" FROM `config`;--> statement-breakpoint
DROP TABLE `config`;--> statement-breakpoint
ALTER TABLE `__new_config` RENAME TO `config`;--> statement-breakpoint
CREATE UNIQUE INDEX `config_key_unique` ON `config` (`key`);--> statement-breakpoint
CREATE TABLE `__new_corrections` (
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
	`applied_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"',
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
INSERT INTO `__new_corrections`("id", "shift_id", "created_by_user_id", "correction_type", "shift_record_id", "product_id", "field_name", "payment_method", "cash_type", "original_value", "corrected_value", "reason", "evidence_url", "applied_at", "revoked_at", "revoked_by_user_id", "revoke_reason") SELECT "id", "shift_id", "created_by_user_id", "correction_type", "shift_record_id", "product_id", "field_name", "payment_method", "cash_type", "original_value", "corrected_value", "reason", "evidence_url", "applied_at", "revoked_at", "revoked_by_user_id", "revoke_reason" FROM `corrections`;--> statement-breakpoint
DROP TABLE `corrections`;--> statement-breakpoint
ALTER TABLE `__new_corrections` RENAME TO `corrections`;--> statement-breakpoint
CREATE TABLE `__new_payment_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pix_rate` text DEFAULT '0.00' NOT NULL,
	`stone_card_rate` text DEFAULT '3.50' NOT NULL,
	`stone_voucher_rate` text DEFAULT '2.50' NOT NULL,
	`pagbank_card_rate` text DEFAULT '3.20' NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"',
	`updated_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"'
);
--> statement-breakpoint
INSERT INTO `__new_payment_config`("id", "pix_rate", "stone_card_rate", "stone_voucher_rate", "pagbank_card_rate", "created_at", "updated_at") SELECT "id", "pix_rate", "stone_card_rate", "stone_voucher_rate", "pagbank_card_rate", "created_at", "updated_at" FROM `payment_config`;--> statement-breakpoint
DROP TABLE `payment_config`;--> statement-breakpoint
ALTER TABLE `__new_payment_config` RENAME TO `payment_config`;--> statement-breakpoint
CREATE TABLE `__new_payroll_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hourly_rate` text DEFAULT '12.50' NOT NULL,
	`food_benefit` text DEFAULT '25.00' NOT NULL,
	`consumption_discount` integer DEFAULT 50 NOT NULL,
	`transport_rates` text DEFAULT '{"bus":8.8,"van":12,"app":15}' NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"',
	`updated_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"'
);
--> statement-breakpoint
INSERT INTO `__new_payroll_config`("id", "hourly_rate", "food_benefit", "consumption_discount", "transport_rates", "created_at", "updated_at") SELECT "id", "hourly_rate", "food_benefit", "consumption_discount", "transport_rates", "created_at", "updated_at" FROM `payroll_config`;--> statement-breakpoint
DROP TABLE `payroll_config`;--> statement-breakpoint
ALTER TABLE `__new_payroll_config` RENAME TO `payroll_config`;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` text NOT NULL,
	`min_stock` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.352Z"'
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "category", "price", "min_stock", "created_at") SELECT "id", "name", "category", "price", "min_stock", "created_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE TABLE `__new_shift_collaborators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`hours_worked` text DEFAULT '0.00',
	`internal_consumption` text DEFAULT '0.00',
	`added_at` integer DEFAULT '"2025-08-10T00:39:38.352Z"',
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_shift_collaborators`("id", "shift_id", "user_id", "hours_worked", "internal_consumption", "added_at") SELECT "id", "shift_id", "user_id", "hours_worked", "internal_consumption", "added_at" FROM `shift_collaborators`;--> statement-breakpoint
DROP TABLE `shift_collaborators`;--> statement-breakpoint
ALTER TABLE `__new_shift_collaborators` RENAME TO `shift_collaborators`;--> statement-breakpoint
CREATE TABLE `__new_shift_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`last_shift_id` integer,
	`carry_cash` text NOT NULL,
	`carry_coins` text NOT NULL,
	`carry_products` text,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"',
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_shift_snapshots`("id", "shift_id", "last_shift_id", "carry_cash", "carry_coins", "carry_products", "created_at") SELECT "id", "shift_id", "last_shift_id", "carry_cash", "carry_coins", "carry_products", "created_at" FROM `shift_snapshots`;--> statement-breakpoint
DROP TABLE `shift_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_shift_snapshots` RENAME TO `shift_snapshots`;--> statement-breakpoint
CREATE TABLE `__new_shifts` (
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
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.352Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_shifts`("id", "user_id", "start_time", "end_time", "initial_cash", "initial_coins", "final_cash", "final_coins", "gas_exchange", "notes", "cash_divergence", "closed_by", "total_sales", "status", "expected_cash", "counted_cash", "counted_coins", "inherited_from_shift_id", "temp_final_cash", "temp_final_coins", "temp_gas_exchange", "counted_final_cash", "counted_final_coins", "envelope_cash", "envelope_coins", "cash_for_next_shift", "coins_for_next_shift", "opening_discrepancy", "created_at") SELECT "id", "user_id", "start_time", "end_time", "initial_cash", "initial_coins", "final_cash", "final_coins", "gas_exchange", "notes", "cash_divergence", "closed_by", "total_sales", "status", "expected_cash", "counted_cash", "counted_coins", "inherited_from_shift_id", "temp_final_cash", "temp_final_coins", "temp_gas_exchange", "counted_final_cash", "counted_final_coins", "envelope_cash", "envelope_coins", "cash_for_next_shift", "coins_for_next_shift", "opening_discrepancy", "created_at" FROM `shifts`;--> statement-breakpoint
DROP TABLE `shifts`;--> statement-breakpoint
ALTER TABLE `__new_shifts` RENAME TO `shifts`;--> statement-breakpoint
CREATE TABLE `__new_timeline` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.353Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_timeline`("id", "user_id", "action", "description", "metadata", "created_at") SELECT "id", "user_id", "action", "description", "metadata", "created_at" FROM `timeline`;--> statement-breakpoint
DROP TABLE `timeline`;--> statement-breakpoint
ALTER TABLE `__new_timeline` RENAME TO `timeline`;--> statement-breakpoint
CREATE TABLE `__new_transport_modes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`round_trip_price` text NOT NULL,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.352Z"',
	`updated_at` integer DEFAULT '"2025-08-10T00:39:38.352Z"'
);
--> statement-breakpoint
INSERT INTO `__new_transport_modes`("id", "name", "round_trip_price", "created_at", "updated_at") SELECT "id", "name", "round_trip_price", "created_at", "updated_at" FROM `transport_modes`;--> statement-breakpoint
DROP TABLE `transport_modes`;--> statement-breakpoint
ALTER TABLE `__new_transport_modes` RENAME TO `transport_modes`;--> statement-breakpoint
CREATE UNIQUE INDEX `transport_modes_name_unique` ON `transport_modes` (`name`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`transport_type` text,
	`transport_mode_id` integer,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.351Z"',
	FOREIGN KEY (`transport_mode_id`) REFERENCES `transport_modes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "password", "name", "role", "transport_type", "transport_mode_id", "created_at") SELECT "id", "email", "password", "name", "role", "transport_type", "transport_mode_id", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `__new_weekly_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` integer NOT NULL,
	`week_end` integer NOT NULL,
	`hourly_rate` text NOT NULL,
	`food_benefit` text DEFAULT '0',
	`consumption_discount` integer DEFAULT 50,
	`transport_rates` text,
	`employee_data` text,
	`created_at` integer DEFAULT '"2025-08-10T00:39:38.352Z"'
);
--> statement-breakpoint
INSERT INTO `__new_weekly_reports`("id", "week_start", "week_end", "hourly_rate", "food_benefit", "consumption_discount", "transport_rates", "employee_data", "created_at") SELECT "id", "week_start", "week_end", "hourly_rate", "food_benefit", "consumption_discount", "transport_rates", "employee_data", "created_at" FROM `weekly_reports`;--> statement-breakpoint
DROP TABLE `weekly_reports`;--> statement-breakpoint
ALTER TABLE `__new_weekly_reports` RENAME TO `weekly_reports`;