/**
 * Recipient gate for the send_invoice_email chat tool. Without this the
 * tool used to forward arbitrary `email` arguments straight through, which
 * (combined with prompt-injected attachments) was an exfil-by-injection
 * path. Audit finding 2026-05-02 #109.
 *
 * Contract:
 *   - supplied empty / null / whitespace + contact has email -> use contact's
 *   - supplied matches contact (case-insensitive, after trim) -> allow
 *   - supplied differs from contact -> REJECT with reason "mismatch"
 *   - supplied empty AND contact has no email -> REJECT with reason "no_contact_email"
 *
 * The UI send dialog has its own (looser) recipient editor — that path is
 * a human-in-the-loop change. The chat tool path is automation, so the
 * default must be "the saved contact email or nothing".
 */
export type RecipientValidation =
  | { ok: true; email: string }
  | { ok: false; reason: "mismatch"; contactEmail: string; supplied: string }
  | { ok: false; reason: "no_contact_email"; supplied: string | null };

function normalise(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function validateInvoiceRecipient(
  supplied: string | null | undefined,
  contactEmail: string | null | undefined,
): RecipientValidation {
  const suppliedNorm = normalise(supplied);
  const contactNorm = normalise(contactEmail);

  // No supplied address - fall back to contact's
  if (!suppliedNorm) {
    if (!contactNorm) {
      return { ok: false, reason: "no_contact_email", supplied: null };
    }
    return { ok: true, email: contactEmail!.trim() };
  }

  // Supplied matches contact (case-insensitive)
  if (contactNorm && suppliedNorm === contactNorm) {
    return { ok: true, email: contactEmail!.trim() };
  }

  // Supplied differs - either contact has a different email, or has none
  if (contactNorm) {
    return {
      ok: false,
      reason: "mismatch",
      contactEmail: contactEmail!.trim(),
      supplied: supplied!.trim(),
    };
  }

  return { ok: false, reason: "no_contact_email", supplied: supplied!.trim() };
}
