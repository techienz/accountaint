CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`provider` text NOT NULL,
	`service_name` text NOT NULL,
	`category` text NOT NULL,
	`cost` real NOT NULL,
	`billing_cycle` text NOT NULL,
	`start_date` text NOT NULL,
	`term_months` integer,
	`renewal_date` text,
	`auto_renew` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`renewal_notified_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`vendor` text NOT NULL,
	`description` text,
	`amount` real NOT NULL,
	`gst_amount` real,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`receipt_path` text,
	`receipt_mime` text,
	`xero_invoice_id` text,
	`ocr_raw` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
