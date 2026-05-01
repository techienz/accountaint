# Annual NZ tax-year refresh playbook

When IRD publishes new tax-year figures (typically March/April each year), follow this checklist to update the app's rate tables and verify everything still ties out.

## Calendar reminder

Set a personal reminder for **mid-April every year** to walk this list. The new tax year begins 1 April; IRD typically publishes confirmed figures within a few weeks.

## Inputs to gather

For each new tax year, you need from IRD:
- Personal income tax brackets (IR3 / IR4 guides, IR340 schedule appendices)
- KiwiSaver minimum employer + default employee rates (KS guide)
- ESCT brackets (IR340 §6)
- Student loan repayment rate + per-period thresholds (IR340 §11)
- ACC earner levy rate + cap (ACC website — usually announced Nov-Dec for the following 1 April)
- Provisional tax dates per balance date (IR4 + IR404 guides)
- Mileage rate (IRD interpretation statement, usually June)
- FBT single rate (IR409)
- Low-value asset threshold (any change is rare)
- Prescribed interest rate (set by Order in Council, usually mid-year)
- Minimum wage (effective 1 April; gazette notice in Feb-Mar)

## Steps

### 1. Add new rate file
Copy `src/lib/tax/rules/{previous}.ts` → `src/lib/tax/rules/{new}.ts`. Update every value to the new IRD numbers. Set `lastUpdated` and `lastVerified` to today's date. Bump `rulesVersion`.

### 2. Register in the rules index
Edit `src/lib/tax/rules/index.ts`:
```ts
import { taxYearXXXX } from "./XXXX";
const taxYears: Record<number, TaxYearConfig> = {
  ...,
  XXXX: taxYearXXXX,
};
```

### 3. Add new fixtures
For every existing test fixture in `test/fixtures/ird/` that's tax-year-specific, add a new fixture for the new year. Source from IRD's calculator or worked examples.

### 4. Run tests
```bash
npm test
```
Existing rate-derived tests should still pass against their original tax year. New fixtures verify the new year.

### 5. Manual verification with IRD's calculator
For at least 3 worked examples (1 PAYE, 1 GST, 1 provisional), plug the inputs into IRD's online calculator and confirm our output matches. Promote those tests from "rate-derived" to "IRD-published-example" in the fixtures README.

### 6. Update knowledge base if guides changed
If IRD updated any of the guides we ingest into LanceDB, re-run the knowledge ingest to refresh the chunks.

### 7. Visit /audit
Confirm the **Tax rules status** check (still in the main dashboard, not /audit) shows the new version. Confirm /audit shows green for everything else (no regressions from the schema changes).

### 8. Bump knowledge-base last-verified date
Even if guides didn't change, set `lastVerified` on the rules file to today so the dashboard shows the rules as fresh.

### 9. Open follow-up issues
Anything you noticed that's worth a separate fix — IRD has changed a guide URL, a calculation needs adjustment, etc.

### 10. Communicate
If multiple users (eventually): post a release note. Mention the tax year is now supported, list any breaking interpretation changes, point at the tax rules version.

## Quick reference URLs

- IRD homepage: https://www.ird.govt.nz/
- PAYE calculator: https://www.ird.govt.nz/income-tax/paye-calculator
- IR340 (Employer's guide): https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir340/ir340-2024.pdf (replace year)
- ACC earner levy: https://www.acc.co.nz/about-us/news-media/all-news/levy-rates/

## Risk if you skip

If the rate tables are stale, every single calculation in the app silently uses last year's numbers. The chat will give wrong tax advice. Provisional tax will be wrong. PAYE deductions on payslips will be wrong. There is no automated detection of "rates are stale by a year" — only human discipline (this playbook).

The Tax Rules Status card on the dashboard surfaces the `lastVerified` date — if it's > 12 months old, it shows red. That's the only safety net.
