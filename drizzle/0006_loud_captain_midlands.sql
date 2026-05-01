CREATE TABLE `recurring_invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`gst_rate` real DEFAULT 0.15 NOT NULL,
	`account_code` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `recurring_invoice_schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_invoice_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`name` text NOT NULL,
	`frequency` text NOT NULL,
	`next_run_date` text NOT NULL,
	`end_date` text,
	`due_days` integer DEFAULT 20 NOT NULL,
	`gst_inclusive` integer DEFAULT false NOT NULL,
	`reference_template` text,
	`notes` text,
	`payment_instructions` text,
	`auto_send` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_generated_at` integer,
	`last_generated_invoice_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`last_generated_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null
);
