import { describe, expect, it } from "vitest";
import { resolveContractForInvoice } from "@/lib/invoices/resolve-contract";

const contracts = [
  { id: "wc_real_uuid_1", client_name: "Digital Uplift Ltd", status: "active" },
  { id: "wc_real_uuid_2", client_name: "Digital Uplift NZ", status: "active" },
  { id: "wc_real_uuid_3", client_name: "Acme Corp", status: "active" },
  { id: "wc_real_uuid_4", client_name: "Old Client", status: "completed" },
];

describe("resolveContractForInvoice", () => {
  it("resolves an exact id match", () => {
    const r = resolveContractForInvoice("wc_real_uuid_3", undefined, contracts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contract.client_name).toBe("Acme Corp");
  });

  it("rejects an invented id with no name fallback (the bug we hit)", () => {
    // Regression: AI passed "contract_digital_uplift_2" — used to throw
    // "Work contract not found: contract_digital_uplift_2" all the way up.
    // Now it returns a structured not_found so the tool can list real ids.
    const r = resolveContractForInvoice("contract_digital_uplift_2", undefined, contracts);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "not_found") {
      expect(r.tried.id).toBe("contract_digital_uplift_2");
    } else {
      throw new Error("expected not_found");
    }
  });

  it("falls back to client_name when id is invalid", () => {
    const r = resolveContractForInvoice("contract_acme_99", "Acme", contracts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contract.id).toBe("wc_real_uuid_3");
  });

  it("does case-insensitive substring match on client_name", () => {
    const r = resolveContractForInvoice(undefined, "acme", contracts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contract.id).toBe("wc_real_uuid_3");
  });

  it("returns ambiguous when name hint matches multiple active contracts", () => {
    const r = resolveContractForInvoice(undefined, "Digital Uplift", contracts);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "ambiguous") {
      expect(r.matches).toHaveLength(2);
    } else {
      throw new Error("expected ambiguous");
    }
  });

  it("ignores completed contracts when matching by name", () => {
    // "Old Client" exists but is completed, so a hint like "old" must not match.
    const r = resolveContractForInvoice(undefined, "Old", contracts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });

  it("still resolves a completed contract when its real id is supplied", () => {
    // Id-based resolution must NOT be limited to active — re-invoicing or
    // historical operations on a completed contract are legitimate.
    const r = resolveContractForInvoice("wc_real_uuid_4", undefined, contracts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contract.status).toBe("completed");
  });

  it("returns not_found when neither id nor hint is supplied", () => {
    const r = resolveContractForInvoice(undefined, undefined, contracts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });

  it("trims whitespace from the name hint", () => {
    const r = resolveContractForInvoice(undefined, "  Acme  ", contracts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contract.id).toBe("wc_real_uuid_3");
  });

  it("treats expiring_soon as active for hint matching", () => {
    const expiring = [
      { id: "wc_x", client_name: "Soon To Expire", status: "expiring_soon" },
    ];
    const r = resolveContractForInvoice(undefined, "soon", expiring);
    expect(r.ok).toBe(true);
  });
});
