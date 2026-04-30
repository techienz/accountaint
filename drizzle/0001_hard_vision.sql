CREATE TABLE `email_log` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`sent_at` integer NOT NULL,
	`kind` text NOT NULL,
	`provider` text DEFAULT 'unknown' NOT NULL,
	`from_address` text,
	`to_address` text NOT NULL,
	`cc_addresses` text,
	`subject` text NOT NULL,
	`attachment_names` text,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	`related_entity_type` text,
	`related_entity_id` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_name` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text DEFAULT 'running' NOT NULL,
	`error_message` text,
	`duration_ms` integer
);
--> statement-breakpoint
ALTER TABLE `work_contracts` ADD `contact_id` text REFERENCES contacts(id);--> statement-breakpoint
ALTER TABLE `work_contracts` ADD `cc_contact_ids` text;