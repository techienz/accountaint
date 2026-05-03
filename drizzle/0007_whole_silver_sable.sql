ALTER TABLE `assets` ADD `is_new` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `is_new_to_nz` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `ib_excluded` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `ib_claimed_amount` real;--> statement-breakpoint
ALTER TABLE `assets` ADD `ib_claimed_tax_year` text;