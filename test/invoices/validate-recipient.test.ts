import { describe, expect, it } from "vitest";
import { validateInvoiceRecipient } from "@/lib/invoices/validate-recipient";

describe("validateInvoiceRecipient", () => {
  it("falls back to contact email when supplied is empty", () => {
    const r = validateInvoiceRecipient(undefined, "client@acme.co.nz");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.email).toBe("client@acme.co.nz");
  });

  it("falls back when supplied is whitespace only", () => {
    const r = validateInvoiceRecipient("   ", "client@acme.co.nz");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.email).toBe("client@acme.co.nz");
  });

  it("allows supplied matching contact email exactly", () => {
    const r = validateInvoiceRecipient("client@acme.co.nz", "client@acme.co.nz");
    expect(r.ok).toBe(true);
  });

  it("allows supplied matching contact email case-insensitively", () => {
    const r = validateInvoiceRecipient("CLIENT@Acme.CO.NZ", "client@acme.co.nz");
    expect(r.ok).toBe(true);
  });

  it("rejects supplied address that differs from contact email", () => {
    // Regression: prompt-injected PDF tells the AI to email attacker@evil.com.
    // Tool used to forward this verbatim. Now it must refuse.
    const r = validateInvoiceRecipient("attacker@evil.com", "client@acme.co.nz");
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "mismatch") {
      expect(r.contactEmail).toBe("client@acme.co.nz");
      expect(r.supplied).toBe("attacker@evil.com");
    } else {
      throw new Error("expected mismatch");
    }
  });

  it("rejects when contact has no email and no supplied address", () => {
    const r = validateInvoiceRecipient(undefined, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_contact_email");
  });

  it("rejects when contact has no email even if supplied is given", () => {
    // Defence-in-depth: if contact has no saved email, refuse all sends.
    // User must add an email to the contact first (UI action), preventing
    // the AI from inventing a recipient out of thin air via injection.
    const r = validateInvoiceRecipient("anyone@example.com", null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_contact_email");
  });

  it("trims whitespace from supplied address before comparison", () => {
    const r = validateInvoiceRecipient("  client@acme.co.nz  ", "client@acme.co.nz");
    expect(r.ok).toBe(true);
  });

  it("trims whitespace from contact email before comparison", () => {
    const r = validateInvoiceRecipient("client@acme.co.nz", "  client@acme.co.nz  ");
    expect(r.ok).toBe(true);
  });
});
