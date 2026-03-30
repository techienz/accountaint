CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`entity_type` text NOT NULL,
	`ird_number` text,
	`balance_date` text DEFAULT '03-31' NOT NULL,
	`gst_registered` integer DEFAULT false NOT NULL,
	`gst_filing_period` text,
	`gst_basis` text,
	`provisional_tax_method` text,
	`has_employees` integer DEFAULT false NOT NULL,
	`paye_frequency` text,
	`nzbn` text,
	`company_number` text,
	`registered_office` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`sanitised_content` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `anomalies` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`change_report_id` text,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`suggested_question` text,
	`status` text DEFAULT 'new' NOT NULL,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `change_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`from_snapshot_id` text NOT NULL,
	`to_snapshot_id` text NOT NULL,
	`changes_json` text NOT NULL,
	`change_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_snapshot_id`) REFERENCES `xero_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_snapshot_id`) REFERENCES `xero_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `xero_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`data` text NOT NULL,
	`data_hash` text NOT NULL,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deadlines` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`due_date` text NOT NULL,
	`tax_year` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`notified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_items` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`type` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`channel` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`detail_level` text DEFAULT 'vague' NOT NULL,
	`config` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`keys_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`active_business_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `xero_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`data` text NOT NULL,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `xero_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`tenant_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_expires_at` integer NOT NULL,
	`scopes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xero_connections_business_id_unique` ON `xero_connections` (`business_id`);