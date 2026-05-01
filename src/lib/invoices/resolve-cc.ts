/**
 * CC resolution for invoice sends. Three-state contract:
 *
 *   - explicit (array): caller is in charge — even an empty array is treated
 *     as "send with NO ccs" (the user cleared the field for this send).
 *   - implicit (undefined): fall back to the contact's saved CCs.
 *
 * The previous behaviour collapsed [] and undefined into the same fallback
 * path, which silently re-added the contact CCs after the user removed them
 * from the send dialog.
 */
export function resolveCcRecipients(
  explicit: string[] | undefined,
  contactCcRaw: string | null,
): string[] | undefined {
  if (Array.isArray(explicit)) {
    const cleaned = explicit.map((e) => e.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (!contactCcRaw) return undefined;
  const fromContact = contactCcRaw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return fromContact.length > 0 ? fromContact : undefined;
}
