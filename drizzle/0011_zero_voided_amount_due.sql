-- Backfill: zero amount_due on existing voided invoices.
--
-- The voidInvoice() function previously left amount_due unchanged, so
-- voided invoices retained whatever was outstanding when they were
-- voided. Any aggregator that filtered by `amount_due > 0` (e.g. the
-- dashboard Money Waiting card) silently included voided invoices in
-- its total. The void path now zeros amount_due going forward; this
-- migration cleans up the existing rows so users immediately see the
-- correct totals after deploy.
UPDATE `invoices` SET `amount_due` = 0 WHERE `status` = 'void' AND `amount_due` != 0;
