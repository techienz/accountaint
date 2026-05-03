import { describe, expect, it } from "vitest";
import {
  buildSanitisationMap,
  sanitise,
  sanitiseXeroData,
  redactEmployeeForChat,
} from "@/lib/ai/sanitise";
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

  // Issue #69 — employee names + employee PII fields were leaking past
  // sanitiseXeroData because employees were never added to the map and
  // unbounded-PII fields (DOB, address, emergency contact) were returned
  // verbatim to the model.
  describe("employee names (#69)", () => {
    it("substitutes the employee name when included in the map", () => {
      const map = buildSanitisationMap(contacts, [], ["Jane Doe"]);
      const out = sanitise("Pay Jane Doe $5000 this fortnight", map);
      expect(out).not.toContain("Jane Doe");
      expect(out).toContain("Employee A");
    });

    it("anonymises distinct employees with sequential labels", () => {
      const map = buildSanitisationMap(contacts, [], ["Jane Doe", "Sam Smith"]);
      expect(sanitise("Jane Doe", map)).toBe("Employee A");
      expect(sanitise("Sam Smith", map)).toBe("Employee B");
    });

    it("does not collide with shareholder labels when both are passed", () => {
      const map = buildSanitisationMap(contacts, ["Kurt Bellian"], ["Jane Doe"]);
      expect(sanitise("Kurt Bellian", map)).toBe("Shareholder A");
      expect(sanitise("Jane Doe", map)).toBe("Employee A");
    });

    it("regression: passing employeeNames=undefined leaks the employee name", () => {
      const correctMap = buildSanitisationMap(contacts, [], ["Jane Doe"]);
      const brokenMap = buildSanitisationMap(contacts);
      expect(sanitise("Jane Doe", correctMap)).not.toContain("Jane Doe");
      expect(sanitise("Jane Doe", brokenMap)).toContain("Jane Doe");
    });

    it("piping a get_employees-shape record through sanitiseXeroData with the employee in the map produces no plaintext name", () => {
      // Same shape get_employees returns (subset). All string leaves get
      // sanitised via the recursive walk in sanitiseXeroData.
      const empRecord = {
        id: "emp_1",
        name: "Jane Doe",
        job_title: "Senior accountant working with Jane Doe",
      };
      const map = buildSanitisationMap(contacts, [], ["Jane Doe"]);
      const out = sanitiseXeroData(empRecord, map);
      expect(out.name).toBe("Employee A");
      expect(out.job_title).not.toContain("Jane Doe");
    });
  });

  describe("redactEmployeeForChat — strip unbounded-PII fields (#69)", () => {
    // The model doesn't need raw email / phone / DOB / address /
    // emergency-contact fields to give payroll or tax advice. Server-side
    // handlers (payslip-email, etc.) look these up by employee_id from the
    // DB. Returning them to Claude is pure leak surface.
    const fullEmployee = {
      id: "emp_1",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "021-555-1234",
      job_title: "Senior accountant",
      department: "Finance",
      ird_number: "123-456-789",
      date_of_birth: "1990-04-15",
      address: "12 Some Road, Wellington",
      emergency_contact_name: "John Doe",
      emergency_contact_phone: "022-555-9999",
      start_date: "2023-01-15",
      end_date: null,
      employment_type: "full_time",
      pay_type: "salary",
      pay_rate: 80000,
      hours_per_week: 40,
      tax_code: "M",
      kiwisaver_enrolled: true,
      kiwisaver_employee_rate: 0.03,
      kiwisaver_employer_rate: 0.03,
      has_student_loan: false,
      leave_annual_balance: 4,
      leave_sick_balance: 5,
      is_active: true,
    };

    it("nullifies email, phone, address, DOB, IRD, emergency contact name + phone", () => {
      const r = redactEmployeeForChat(fullEmployee);
      expect(r.email).toBeNull();
      expect(r.phone).toBeNull();
      expect(r.address).toBeNull();
      expect(r.date_of_birth).toBeNull();
      expect(r.ird_number).toBeNull();
      expect(r.emergency_contact_name).toBeNull();
      expect(r.emergency_contact_phone).toBeNull();
    });

    it("preserves the fields the model needs to give advice", () => {
      const r = redactEmployeeForChat(fullEmployee);
      expect(r.id).toBe("emp_1");
      expect(r.name).toBe("Jane Doe"); // anonymisation happens later via sanitiseXeroData
      expect(r.job_title).toBe("Senior accountant");
      expect(r.department).toBe("Finance");
      expect(r.pay_rate).toBe(80000);
      expect(r.tax_code).toBe("M");
      expect(r.kiwisaver_enrolled).toBe(true);
      expect(r.is_active).toBe(true);
    });

    it("end-to-end: redact then sanitise → no plaintext PII in the result tree", () => {
      const map = buildSanitisationMap(contacts, [], ["Jane Doe"]);
      const out = sanitiseXeroData(redactEmployeeForChat(fullEmployee), map);
      const json = JSON.stringify(out);
      expect(json).not.toContain("Jane Doe");
      expect(json).not.toContain("jane@example.com");
      expect(json).not.toContain("021-555-1234");
      expect(json).not.toContain("12 Some Road");
      expect(json).not.toContain("1990-04-15");
      expect(json).not.toContain("John Doe");
      expect(json).not.toContain("022-555-9999");
      // IRD number is also stripped (was redacted to null, regardless of regex).
      expect(json).not.toContain("123-456-789");
    });
  });
});
