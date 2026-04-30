CREATE TABLE `chat_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text,
	`conversation_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`args_json` text,
	`result_summary` text,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
