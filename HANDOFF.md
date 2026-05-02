# HANDOFF — Pre-migration

## Branch & commit

- **Branch:** `main`
- **HEAD:** `5362e25` — `feat(audit-2026-05-02): honesty test runner — 8 questions, warn-only CI (#130) (#136)`
- **Pushed:** yes — local main is in sync with `origin/main`
- **Working tree:** clean (verified with `git status`)

## What I was doing

Working through the polish-audit (`audit/accountaint-polish-final.md`) follow-up. The user resolved five architectural decisions (#120-#124) and we executed the plan in 6 sequential PR waves: NZ tax correctness → polish (System integrity rename + glossary) → GST calculator unification → Subscriptions UI rename → Snapshot rebuild ledger-first → Honesty test runner. All 6 PRs (#131-#136) are merged. The session ended at a natural checkpoint — every wave shipped, all tests passing.

## State at handoff

- **Committed and merged:** every change from this session lives in `main` via PRs #131-#136. Nothing in progress, nothing stashed.
- **Test suite:** 245 passing (was 215 at start of session — +30 net new).
- **No migrations:** none of the 6 PRs in this batch touched the schema. Last migration was `0006_loud_captain_midlands.sql` from PR #107 (already deployed).
- **Action issues closed:** #72, #77, #84, #86 (Wave 1); #115 (Wave 3); #127, #128 (Waves 2+4); #129 (Wave 5a); #130 (Wave 5b). Decision issues #120-#124 closed earlier.

## Next steps

1. **Deploy the merged work.** `cd ~/accountaint-docker && docker compose pull && docker compose up -d` once the GHA Docker build finishes for `5362e25`. No DB migrations to apply.
2. **Manual verification of the Wave 1 NZ-tax-correctness changes.** Highest user-impact items per the original plan: home-office sqm_rate (PR #131), mileage tier 1/2 (#131), prescribed interest quarterly breakdown (#131), 2025 tax-year config (#131). Walk through the calculators + IR3 prep with real numbers and confirm.
3. **Pick the next wave of work** from the remaining open audit issues. The 11 HIGH-severity items from the original audit (`audit-2026-05-01`) are still open: #67 (SQLCipher), #68 (XFF rate-limit), #69 (employee names PII — partial coverage from Batch B already), #70 (xlsx replacement + dep bumps), #71 (4-digit PIN), and the rest. Run `gh issue list --state open --label severity-high` to see the current set.

## Open questions / blockers

None active. A few things flagged in PR descriptions worth tracking:

- **Test-DB harness** — Wave 5b honesty runner is wired in STUB mode only because there's no test-DB harness. Same constraint blocks full integration tests for the GST calc (Wave 3) and the snapshot ledger metrics (Wave 5a). Building this harness would unlock several stuck tests at once.
- **2026/2027 mileage + sqm rates** are placeholders (using 2025 figures) until IRD publishes new operational statements (typically May/June). The rules-freshness UI flags them.
- **Vehicle DB schema** doesn't yet capture `fuel_type` / `total_vehicle_km` / `regime` / `hasLogbook`. Calculator does the right tier 1/2 math but the existing UI form silently defaults to "petrol, 100% business". Schema migration is a follow-up.
- **GST zero-rated sales** under-report Box 5 — separate small bug noted in audit, not fixed in #115.

## Gotchas

- **`next-env.d.ts`** is auto-regenerated on every `next build` / `next dev`. Often appears as modified in `git status`; safe to ignore (it's git-ignored conceptually but tracked for type help).
- **`tsx` runtime dependency** — the new `npm run honesty` script (PR #136) uses `npx tsx scripts/honesty.ts`. `tsx` isn't a direct dep but matches the existing `scripts/ingest-knowledge.ts` pattern. First run on a fresh checkout will pull it via npx cache.
- **No services were running** locally during this session — everything ran via the Docker container (`accountaint` on host networking, port 3020). No process to kill.
- **Multi-issue `Closes #N` PR descriptions don't auto-close all referenced issues on squash merge** — known GitHub behaviour, manual `gh issue close` was used throughout this session.
- **PR #135's snapshot rebuild changes the chat tool result shape** for `get_business_snapshot` — was a flat `SnapshotMetrics`, now `{ source: 'local_only' | 'local_with_xero_overlay', metrics, xero?, compare? }`. Any downstream code consuming the old shape needs updating.
- **PR #134 keeps the schema as `contracts`** even though the UI now says "Subscriptions". `/api/contracts/*`, `schema.contracts`, `getContractSummary()` etc. are all still the original names. Rename was intentionally scoped to UI per decision #121 Option B.
- **The 5 background investigation agents and the Docker-build Monitor used during this session have all completed.** No live tasks. `jobs` returns nothing.

## Memory I wrote this session

**None.** No files in `~/.claude/projects/-home-kurt-dev-accountaint/memory/` were created or modified — the existing 8 memory files (last edited Apr 14 / 16 / 30) cover everything I needed. Most recent: `feedback_service_restart.md`, `MEMORY.md`, `reference_public_repo.md` (Apr 30 22:20-22:21).
