# Payroll fixtures

Tests in this area cover PAYE, KiwiSaver, ESCT, student loan, and ACC earner levy.

## Two flavours of test

**Rate-derived** — uses the rate tables in `src/lib/tax/rules/{year}.ts` as the source of truth, asserts the calculator computes the correct value from them. Catches regressions in calculation logic but does **not** independently verify the rates themselves are right.

**IRD-published-example** — encodes a worked example from an IRD publication (IR340, PAYE calculator screenshot, etc.). Catches BOTH calculation bugs AND wrong rate tables. The gold standard.

Most tests below start as rate-derived and will be promoted to IRD-published-example as IR340 examples are transcribed.

## Source of truth references

- **PAYE bands & rates**: IR340 Employer's guide, current year's PAYE rates
- **KiwiSaver minimum employer + default employee rates**: KiwiSaver Act 2006 + IRD KS website
- **ESCT bands**: IR340 §6 (ESCT)
- **Student loan rate + threshold**: IR340 §11 + IRD calculator
- **ACC earner levy rate + cap**: ACC website (annual updates)

## When IRD updates rates

Each annual refresh (per the playbook in #36):
1. Update `src/lib/tax/rules/{newyear}.ts`
2. Add new fixtures for the new tax year
3. Run `npm test` to confirm rate-derived tests still pass against new rates
4. Manually verify against IRD's calculator with at least 3 transcribed worked examples
