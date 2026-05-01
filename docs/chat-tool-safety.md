# Chat tool safety inventory

Audit of every chat tool that mutates state. Goal: nothing irreversible happens without an explicit human-confirmed preview.

Two layers of safety:
- **Soft** — tool description tells the AI to "always confirm before X". Relies on Claude following instructions. Mostly works, sometimes doesn't.
- **Hard** — tool requires an explicit `confirm: true` parameter. First call (no `confirm`) returns a preview. Second call (with `confirm: true` and matching preview-token where applicable) executes. Enforced in code, not prompt.

## Inventory

| Tool | Risk | Soft ✓ | Hard ✓ | Notes |
|------|------|--------|--------|-------|
| `declare_dividend` | **Financial, irreversible** (creates board resolution PDF + posts journals + records shareholder transactions) | ✓ | ✓ | First mover for hard pattern |
| `delete_timesheet_entries` | **Destructive, bulk** | ✓ | ✓ | First mover for hard pattern |
| `create_pay_run` | Financial, but draft — finalise is the destructive step | ✓ | — | TODO: extend confirm pattern |
| `finalise_pay_run` | **Financial, irreversible** (locks pay run + posts journals + emits payslips) | ✓ | — | TODO: extend confirm pattern |
| `send_invoice_email` | Outbound communication, sometimes-irreversible | ✓ | — | UI dialog already provides preview; chat path lacks gate |
| `email_payslips` | Outbound, multi-recipient | ✓ | — | UI dialog already provides preview; chat path lacks gate |
| `email_timesheet` | Outbound | ✓ | — | UI dialog already provides preview; chat path lacks gate |
| `create_invoice_from_timesheets` | Reversible (invoice can be voided) | ✓ | — | Lower risk; document gap, defer |
| `create_timesheet_entry` | Reversible | — | — | Single entry, low risk |
| `approve_timesheet_entries` | Soft state change | — | — | Reversible via "back to draft" |
| `create_expense` | Reversible (can be deleted) | — | — | Single entry, low risk |
| `create_contact` | Reversible | — | — | Trivial mutation |
| `update_work_contract` | Reversible | — | — | Updates existing record |

## The "hard confirm" pattern

```ts
// Tool input schema
{
  // ...regular params...
  confirm: { type: "boolean", description: "Set to true ONLY after showing the preview to the user and getting their explicit yes." }
}

// Tool implementation
case "declare_dividend": {
  const totalAmount = toolInput.total_amount as number;
  const date = (toolInput.date as string) || todayNZ();
  const confirm = toolInput.confirm === true;

  if (!confirm) {
    // Build preview: show shareholders + amounts + journal effect, return for review
    return {
      preview: true,
      action: "Declare dividend",
      total_amount: totalAmount,
      date,
      breakdown: ...,
      message: "Show this preview to the user. If they confirm, call again with confirm: true.",
    };
  }
  // Actually do it
  return await declareDividend(...);
}
```

The system prompt enforces:
> When a mutating tool returns a preview, present it to the user verbatim and wait for explicit yes/no. Only call again with `confirm: true` when the user has said yes.

## Outstanding work

Open follow-up issues to extend hard pattern to:
1. `finalise_pay_run` (highest priority — destructive + financial)
2. `send_invoice_email`, `email_payslips`, `email_timesheet` (outbound; UI dialogs work but chat path bypasses)
3. `create_pay_run` (it's the gateway to finalise)

The remaining tools (`create_timesheet_entry`, `create_contact`, etc.) are reversible and individually low-stakes — soft confirm via description is acceptable for them.
