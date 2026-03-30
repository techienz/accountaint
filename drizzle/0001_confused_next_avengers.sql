CREATE TABLE `asset_depreciation` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`opening_book_value` real NOT NULL,
	`depreciation_amount` real NOT NULL,
	`closing_book_value` real NOT NULL,
	`depreciation_recovered` real,
	`loss_on_sale` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`purchase_date` text NOT NULL,
	`cost` real NOT NULL,
	`depreciation_method` text NOT NULL,
	`depreciation_rate` real NOT NULL,
	`is_low_value` integer DEFAULT false NOT NULL,
	`disposed` integer DEFAULT false NOT NULL,
	`disposal_date` text,
	`disposal_price` real,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `acc_config` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`cu_code` text,
	`cu_description` text,
	`liable_earnings` real NOT NULL,
	`levy_rate` real NOT NULL,
	`estimated_levy` real NOT NULL,
	`actual_levy` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fbt_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`quarter` integer NOT NULL,
	`benefits_json` text NOT NULL,
	`total_taxable_value` real DEFAULT 0 NOT NULL,
	`fbt_payable` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `home_office_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`method` text NOT NULL,
	`office_area_sqm` real NOT NULL,
	`total_area_sqm` real NOT NULL,
	`costs_json` text NOT NULL,
	`total_claim` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vehicle_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`method` text NOT NULL,
	`total_business_km` real,
	`mileage_rate` real,
	`business_use_percentage` real,
	`actual_costs_json` text,
	`total_claim` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vehicle_logbook_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`vehicle_claim_id` text NOT NULL,
	`date` text NOT NULL,
	`from_location` text NOT NULL,
	`to_location` text NOT NULL,
	`km` real NOT NULL,
	`purpose` text,
	`is_business` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_claim_id`) REFERENCES `vehicle_claims`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `income_tax_prep` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`return_type` text NOT NULL,
	`shareholder_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`data_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shareholder_id`) REFERENCES `shareholders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `personal_income_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shareholder_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`source_type` text NOT NULL,
	`description` text,
	`amount` real NOT NULL,
	`tax_paid` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shareholder_id`) REFERENCES `shareholders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tax_loss_records` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`loss_amount` real NOT NULL,
	`carried_forward` real NOT NULL,
	`continuity_met` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tax_savings_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`month` text NOT NULL,
	`gst_component` real DEFAULT 0 NOT NULL,
	`income_tax_component` real DEFAULT 0 NOT NULL,
	`total_target` real DEFAULT 0 NOT NULL,
	`actual_set_aside` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shareholder_salary_config` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shareholder_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`salary_amount` real DEFAULT 0 NOT NULL,
	`dividend_amount` real DEFAULT 0 NOT NULL,
	`imputation_credits` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shareholder_id`) REFERENCES `shareholders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shareholder_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shareholder_id` text NOT NULL,
	`tax_year` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`amount` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shareholder_id`) REFERENCES `shareholders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shareholders` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`ird_number` text,
	`ownership_percentage` real NOT NULL,
	`is_director` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
