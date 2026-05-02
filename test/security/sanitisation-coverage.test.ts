import { describe, expect, it } from "vitest";
import { buildSanitisationMap, sanitise } from "@/lib/ai/sanitise";
import type { XeroContact } from "@/lib/xero/types";

/**
 * Audit #119 — three regression cases for PII paths that were previously
 * leaking past the sanitiser into the Claude prompt:
 *   1. Akahu account / institution names containing the user's own name
 *   2. Bank transaction descriptions/merchants containing contact names
 *   3. Shareholder names not in the inbound sanitisation map
 *
 * These tests exercise the sanitiser primitives that the chat route and
 * tool dispatch now call. They don't spin up the dispatcher itself
 * (that needs a DB), but they pin the contract those callsites depend on.
 */

const contacts: XeroContact[] = [
  { Name: "Acme Corp Ltd", IsCustomer: true, IsSupplier: false } as XeroContact,
  { Name: "Office Stationers NZ", IsCustomer: false, IsSupplier: true } as XeroContact,
];

describe("PII sanitisation coverage", () => {
  describe("shareholder names (#119 leak 3)", () => {
    it("substitutes the shareholder name when included in the map", () => {
      const map = buildSanitisationMap(contacts, ["Kurt Bellian"]);
      const out = sanitise("pay Kurt Bellian a $5000 dividend", map);
      expect(out).not.toContain("Kurt Bellian");
      expect(out).toContain("Shareholder A");
    });

    it("regression: passing shareholderNames=undefined leaks the name verbatim", () => {
      // This is the OLD bug path — chat route used to call buildSanitisationMap(contacts)
      // without the second argument. We verify the sanitiser is correct by
      // showing a CORRECT use protects the name and the broken use does not.
      const correctMap = buildSanitisationMap(contacts, ["Kurt Bellian"]);
      const brokenMap = buildSanitisationMap(contacts);
      expect(sanitise("Kurt Bellian", correctMap)).not.toContain("Kurt Bellian");
      expect(sanitise("Kurt Bellian", brokenMap)).toContain("Kurt Bellian");
    });
  });

  describe("Akahu account / institution names (#119 leak 1)", () => {
    it("anonymises a contact name embedded in an account label", () => {
      // Akahu's account labels often include the owner's name on the account
      // (e.g. "Acme Corp Ltd - Cheque"). We simulate that here.
      const map = buildSanitisationMap(contacts);
      const out = sanitise("Acme Corp Ltd - Cheque Account", map);
      expect(out).not.toContain("Acme Corp Ltd");
      expect(out).toContain("Customer A");
    });

    it("anonymises a shareholder name that ended up in an Akahu label", () => {
      const map = buildSanitisationMap(contacts, ["Kurt Bellian"]);
      const out = sanitise("Kurt Bellian Personal Cheque", map);
      expect(out).not.toContain("Kurt Bellian");
    });
  });

  describe("bank transaction descriptions (#119 leak 2)", () => {
    it("anonymises contact names in a transaction description", () => {
      const map = buildSanitisationMap(contacts);
      const desc = "Payment received from Acme Corp Ltd reference INV-007";
      const out = sanitise(desc, map);
      expect(out).not.toContain("Acme Corp Ltd");
      expect(out).toContain("Customer A");
    });

    it("anonymises supplier names in expense memos", () => {
      const map = buildSanitisationMap(contacts);
      const desc = "Office Stationers NZ - monthly subscription";
      const out = sanitise(desc, map);
      expect(out).not.toContain("Office Stationers NZ");
      expect(out).toContain("Supplier A");
    });

    it("leaves unknown merchant names untouched (best effort — not a regression)", () => {
      // The sanitiser only knows about contacts + shareholders. A novel
      // merchant name in a tx description still passes through; this is
      // the documented limitation, not a fix gap.
      const map = buildSanitisationMap(contacts);
      const out = sanitise("Random Cafe Wellington", map);
      expect(out).toContain("Random Cafe Wellington");
    });

    it("strips IRD numbers and bank account numbers regardless", () => {
      const map = buildSanitisationMap([]);
      const out = sanitise("Sent IRD 123-456-789 from 12-3456-7890123-00", map);
      expect(out).toContain("[IRD ***]");
      expect(out).toContain("[Bank ***]");
    });
  });
});
