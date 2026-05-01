# Chat tool safety inventory

Audit of every chat tool that mutates state. Goal: nothing irreversible happens without an explicit human-confirmed preview that can't be faked by the model.

Three layers of safety, in order of strength:

- **Soft (prompt-only)** — the tool description and system prompt instruct the AI to "always show a preview and wait for confirmation". Relies on Claude following instructions. Mostly works, sometimes doesn't, **never hardened against prompt injection** in attached PDFs / memos. Use only for low-stakes, easily reversible mutations.

- **Recipient gate** — the tool refuses unless a critical argument matches a value the user has separately set in the UI (e.g. `send_invoice_email` requires `email` to match `contact.email`). Defends against the AI inventing a recipient out of thin air via injected text. Implementation: `src/lib/invoices/validate-recipient.ts`.

- **Hard (preview_token state machine)** — the tool issues a server-side token on the first call (preview only, no mutation). The AI must pass that token back on the second call to actually execute. The token is bound to the call's args via SHA-256 hash, so changing args between preview and execute invalidates it. Single-use, 5-min TTL, business-scoped, atomically claimed. Six distinct rejection reasons for diagnostics. Implementation: `src/lib/ai/preview-token.ts` and the `preview_tokens` table.

## Inventory

| Tool | Risk | Soft ✓ | Recipient gate ✓ | preview_token ✓ | Notes |
|------|------|--------|------------------|------------------|-------|
| `declare_dividend` | **Financial, irreversible** (creates board resolution PDF + posts journals + records shareholder transactions) | ✓ | — | ✓ | First mover (#62 / PR #106) |
| `delete_timesheet_entries` | **Destructive, bulk** | ✓ | — | ✓ | First mover (#62 / PR #106). Also refuses entries with status="invoiced" — see #112. |
| `send_invoice_email` | Outbound communication, sometimes-irreversible | ✓ | ✓ | — | Recipient gate prevents exfiltration to attacker-supplied addresses. preview_token wrap-up tracked as #118. |
| `finalise_pay_run` | **Financial, irreversible** (locks pay run + posts journals + emits payslips) | ✓ | — | — | Tracked for preview_token in #118. |
| `email_payslips` | Outbound, multi-recipient | ✓ | — | — | Tracked for preview_token in #118. |
| `email_timesheet` | Outbound | ✓ | — | — | Tracked for preview_token in #118. |
| `create_pay_run` | Financial, but draft — finalise is the destructive step | ✓ | — | — | Could pick up preview_token alongside finalise_pay_run. |
| `create_invoice_from_timesheets` | Reversible (invoice can be voided) | ✓ | — | — | Lower risk; soft acceptable for now. |
| `create_expense` | Reversible (can be deleted) | — | — | — | Single entry, low risk. Audit fix #108 routed it through canonical `createExpense`/`updateExpense` so it now posts to the ledger as expected. |
| `create_timesheet_entry` | Reversible | — | — | — | Single entry, low risk. |
| `approve_timesheet_entries` | Soft state change | — | — | — | Reversible via "back to draft". |
| `create_contact` | Reversible | — | — | — | Trivial mutation. |
| `update_work_contract` | Reversible | — | — | — | Updates existing record. |

## The preview_token state machine

The pattern, in two calls:

```ts
// Call 1: preview, no token in args
case "declare_dividend": {
  const previewToken = toolInput.preview_token as string | undefined;

  if (!previewToken) {
    // Build the preview: shareholders + per-head amounts + journal effect
    const args = canonicalArgsForToken(toolInput);
    const token = issuePreviewToken({
      businessId,
      userId,
      toolName: "declare_dividend",
      args,
    });
    return {
      preview: true,
      breakdown: ...,
      preview_token: token,
      message:
        "PREVIEW. Show this breakdown to the user verbatim. " +
        "To execute, call declare_dividend AGAIN with the SAME total_amount/date/notes plus preview_token=" + token + ". " +
        "Token is single-use, expires in 5 minutes, and is invalidated if any args change.",
    };
  }

  // Call 2: token present — verify and atomically claim
  const consume = consumePreviewToken({
    token: previewToken,
    businessId,
    toolName: "declare_dividend",
    args: toolInput,
  });
  if (!consume.ok) {
    return { error: `Preview token rejected: ${consume.reason}. Re-issue a preview by calling declare_dividend without preview_token.` };
  }

  // Actually do it
  return await declareDividend(...);
}
```

### Rejection reasons (`consumePreviewToken`)

- `missing` — token doesn't exist in the table
- `wrong_business` — token belongs to a different business
- `wrong_tool` — token was issued for a different tool name
- `args_changed` — args hash doesn't match the preview the user saw
- `expired` — past the 5-minute TTL
- `already_used` — atomic claim failed (token consumed by another concurrent call)

The args-hash binding is the key safety property: an AI that previews "dividend $1,000" and then tries to execute "dividend $10,000" with the same token gets `args_changed`. The user only ever approves what was previewed.

### What the `preview_token` field looks like in the schema

```ts
{
  id: text PRIMARY KEY,            // also the token value (opaque uuid)
  business_id: text FK,
  user_id: text,
  tool_name: text NOT NULL,
  args_hash: text NOT NULL,        // SHA-256 of canonical args
  created_at: timestamp,
  expires_at: timestamp,            // created_at + 5 min
  used_at: timestamp,               // null until claimed
}
```

`canonicalArgs` strips `preview_token` and `confirm` from the hash so the same args produce the same hash on both calls.

## The recipient gate (lighter-weight, complementary)

For tools whose risk is "AI is tricked into picking the wrong recipient" rather than "AI does the wrong thing entirely", the recipient gate is enough on its own. Pattern:

```ts
import { validateInvoiceRecipient } from "@/lib/invoices/validate-recipient";

case "send_invoice_email": {
  const inv = getInvoice(invoiceId, businessId);
  const v = validateInvoiceRecipient(toolInput.email, inv.contact_email);
  if (!v.ok) {
    if (v.reason === "mismatch") return { error: "...", available_contact_email: v.contactEmail };
    if (v.reason === "no_contact_email") return { error: "Add a contact email first" };
  }
  await sendInvoiceEmail(invoiceId, businessId, v.email, ...);
}
```

The validator refuses any `email` argument that doesn't match the contact's saved email. If the user actually wants to send to a different address, they have to update the contact in the UI first — explicit, human-driven, audited.

## Outstanding work

Tracked in GitHub issues:

- **#118** — wrap `finalise_pay_run`, `email_payslips`, `email_timesheet`, `send_invoice_email` in the preview_token state machine.
- **#112** — block deletion of invoiced timesheet entries (done — landed in this batch).
- **#119** — close the three remaining PII leak paths so they can't carry an injected payload to the model in the first place.

The remaining tools (`create_timesheet_entry`, `create_contact`, etc.) are reversible and individually low-stakes — soft confirm via description is acceptable for them.

## Why these layers, not just one

| Threat | Soft prompt | Recipient gate | preview_token |
|---|---|---|---|
| AI hallucinates and runs the wrong tool | Reduces risk if AI follows instructions | Doesn't help | Stops the second call until user says yes |
| Prompt injection in attached PDF tells AI "do X" | **Defeated easily** | Stops attacker-supplied addresses | Stops the second call entirely |
| User clicks "yes" too quickly without reading | No defence | No defence | Args-hash binding catches mid-flow tampering |
| User intentionally tells AI to act on something irreversible | No defence | No defence | One round-trip review surface; user can say no |

Soft alone is not enough for irreversible mutations. preview_token is the only layer that holds against prompt injection AND fast-clicker users.
