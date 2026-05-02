# Accountaint

AI-powered NZ business accountant and financial partner running locally. Multi-tenant, Xero-integrated, with NZ tax compliance knowledge. Acts as the user's accountant — gives direct, confident financial advice backed by NZ tax law rather than deferring to external professionals.

## Documentation

Full architecture, design decisions, and knowledge system design are documented in the **GitHub wiki** — always check here first for context:

- **[Architecture](https://github.com/techienz/accountaint/wiki/Architecture)** — system diagram, tech stack, AI model routing, RAG pipeline, MCP servers, data flow
- **[NZ Tax Knowledge](https://github.com/techienz/accountaint/wiki/NZ-Tax-Knowledge)** — 3-layer knowledge system (deterministic rules, RAG, Claude reasoning), IRD guide list, ingest pipeline
- **[Design Decisions](https://github.com/techienz/accountaint/wiki/Design-Decisions)** — rationale for every architectural choice (LanceDB, dual LLM, PII sanitisation, etc.)
- **[Database Schema](https://github.com/techienz/accountaint/wiki/Database-Schema)** — schema design
- **[Xero Integration](https://github.com/techienz/accountaint/wiki/Xero-Integration)** — OAuth2 flow, sync strategy

To read the wiki locally: `git clone https://github.com/techienz/accountaint.wiki.git /tmp/accountaint-wiki`

## Design Principles

### Security & Privacy First
- All financial data stays local in SQLite. No cloud database.
- ~30 sensitive columns (Xero/Akahu/Microsoft Graph tokens, IRD numbers, contact CCs, employee details, etc.) are AES-GCM encrypted at the field level before storage. **Full-database encryption (SQLCipher) is on the roadmap (#67) but not yet implemented** — the database file itself is plaintext SQLite, so disk-level access is a real exposure for now.
- PII is always anonymised before sending to Claude API — names, IRD numbers, bank accounts stripped. Dollar amounts preserved but attributed to anonymised entities.
- PII-sensitive tasks (OCR, categorisation, summarisation) should use the local LLM (Qwen3.5-9B via LM Studio) so data never leaves the device. Fall back to Claude Haiku with sanitisation if LM Studio is unavailable.
- Xero and Akahu OAuth tokens, and Microsoft Graph credentials, are field-encrypted before DB storage.
- Notifications are vague by default — no dollar amounts, account numbers, or entity names unless the user explicitly opts in per channel.
- Never log sensitive data. Sanitise before logging.
- Validate all inputs at system boundaries. Never trust data from Xero or external APIs without validation.

### Simplicity
- The UI should be approachable for non-technical business owners. No jargon, no clutter.
- Prefer sensible defaults over configuration. Ask only what's necessary during setup.
- One-click actions where possible (connect Xero, sync data, generate report).
- Error messages should be human-readable and suggest what to do next.

### Multi-Business Support
- Every feature must work correctly in a multi-tenant context — never leak data between businesses.
- Business switcher should be always accessible and obvious.
- Support different entity types: company, sole trader, partnership, trust — each has different tax obligations.
- Different businesses may have different GST filing periods, balance dates, and provisional tax methods.

### NZ Tax Accuracy
- Tax rules are coded per tax year and versioned. Never hardcode a rate inline — always reference the tax rules module.
- When giving tax advice via AI, prefer RAG-sourced IRD guidance over general knowledge. Always cite the source (guide code + section).
- Flag genuine uncertainty honestly — if a tax rule has changed or is ambiguous, say so and give a recommendation. Never deflect to "consult an accountant" — the app IS the accountant.
- Display a "tax rules last updated" indicator so users know if rules may be stale.

### Plan Before Building
- Always plan a feature before implementing it. Use plan mode to align on approach, file structure, and key decisions before writing code.
- Never jump straight into coding — even for seemingly straightforward features, take a moment to outline what will be built and how.
- Plans should cover: what files will be created/modified, key design decisions, security considerations, and how multi-tenancy is handled.

### Code Quality
- Keep it simple. Don't over-engineer or add abstractions for hypothetical future needs.
- Use Drizzle ORM for all database access — no raw SQL unless absolutely necessary.
- Server components by default, client components only when interactivity is needed.
- All API routes must check authentication and business ownership before returning data.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** Tailwind CSS + shadcn/ui + Plus Jakarta Sans
- **Database:** SQLite via better-sqlite3 + Drizzle ORM (field-level AES-GCM encryption today; full-DB SQLCipher on roadmap #67)
- **Vector Store:** LanceDB (embedded, hybrid vector + BM25 search)
- **LLM (reasoning):** Claude API — Sonnet for chat/tax advice (PII-sanitised)
- **LLM (local):** LM Studio + Qwen3.5-9B — OCR, categorisation, summarisation (PII stays on device)
- **Embeddings:** LM Studio + Nomic Embed Text V2 (local, no data leaves server)
- **MCP:** @modelcontextprotocol/sdk — AI tool calling for Xero, tax engine, GST calculator, knowledge search
- **Bank feeds:** Akahu (read-only OAuth2) — primary source for transactions and balances
- **Accounting integration:** Xero (xero-node SDK + OAuth2) — optional sync for businesses already on Xero
- **Email:** SMTP or Microsoft Graph (OAuth2 client_credentials) for invoices, payslips, reminders
- **Notifications:** Email, web-push (desktop), Slack webhooks
- **Scheduler:** node-cron (in-process)
- **Auth:** bcryptjs + jose (JWT), email + 4-digit PIN

## AI Model Routing

| Task | Model | Reason |
|------|-------|--------|
| Tax advice, compliance questions | Claude Sonnet (API) | Needs strong reasoning, data is PII-sanitised |
| Receipt OCR | Qwen3.5-9B (local) | Raw images contain PII |
| Expense categorisation | Qwen3.5-9B (local) | Raw vendor names |
| Document summarisation | Qwen3.5-9B (local) | Uploaded docs may contain PII |
| Xero change summaries | Qwen3.5-9B (local) | Raw financial data |
| Text embeddings | Nomic Embed V2 (local) | All text stays on device |
| Complex financial analysis | Claude Sonnet (API) | Sanitised, needs deep reasoning |

If LM Studio is unavailable, local tasks fall back to Claude Haiku with PII sanitisation.

## Architecture

- Multi-tenant: each business has its own Akahu/Xero connection, tax config, chat history
- All financial data stays local in SQLite. Field-level AES-GCM encryption protects ~30 sensitive columns; full-DB encryption (SQLCipher) is on the roadmap (#67) but not yet implemented — disk-level access to `accountaint.db` exposes plaintext rows for the un-encrypted columns
- PII is anonymised before sending to Claude API
- Local LLM handles tasks with raw PII (data never leaves device)
- RAG pipeline: LanceDB hybrid search over IRD guide chunks, embedded locally via Nomic V2
- MCP servers expose tools for AI (Xero data, tax engine, GST calculator, knowledge search)
- Notifications are vague by default (no dollar amounts unless opted in)

## Commands

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run start` — start production server
- `npx drizzle-kit push` — push schema changes to database
- `npx drizzle-kit generate` — generate migration files

## Project Structure

```
src/
  app/              # Next.js app router pages
    (auth)/         # Login, setup, onboarding
    (dashboard)/    # Dashboard, settings, all feature pages
    api/            # API routes
  components/       # React components
    ui/             # shadcn/ui primitives
    dashboard/      # Dashboard cards
    snapshot/       # Business snapshot components
    expenses/       # Expense components
  lib/
    db/             # Drizzle schema and migrations
    xero/           # Xero API integration (sync, client, types)
    tax/            # NZ tax rules (versioned), deadlines, calculators
    ai/             # Claude API, PII sanitisation, chat tools
    knowledge/      # RAG: LanceDB store, retriever, fetcher, ingest (planned)
    lmstudio/       # LM Studio client, embeddings, local LLM (planned)
    contracts/      # Contract & subscription management
    expenses/       # Expense tracking, receipt OCR
    reports/        # Business snapshot metrics
    notifications/  # Email, desktop, Slack handlers
    scheduler/      # Cron jobs (Xero sync, deadlines, contract renewals)
    shareholders/   # Shareholder accounts, salary/dividend optimiser
    calculators/    # Home office, vehicle, FBT, ACC calculators
    crosscheck/     # Xero change detection, anomaly flagging
  mcp/              # MCP servers for AI tools (planned)
data/
  accountaint.db    # SQLite database (~30 columns field-encrypted; full-DB SQLCipher on roadmap #67)
  receipts/         # Uploaded receipt files per business
  lancedb/          # Vector store data (planned)
  ird-guides/       # Downloaded IRD guide PDFs (planned)
drizzle/            # Migration files
```

## Users

Example users: a sole director company (no employees) and a company with employees. Both use Xero. The app serves as their accountant and financial partner — managing tax compliance, financial strategy, and business decisions without needing an external accountant.

## Glossary — disambiguating overloaded terms

The codebase carries a few words that mean different things in different places. When writing chat tool descriptions, UI copy, or new code, prefer the prefixed form below over the bare term.

### "Transaction" — four distinct meanings
- **`bank_tx`** → `bank_transactions` table (Akahu bank-feed entries). Tools: `get_bank_transactions`, `match_bank_transaction`, `categorise_bank_transaction`, `reconcile_bank_transaction`, `exclude_bank_transaction`, `suggest_bank_matches`.
- **`budget_tx`** → `budget_transactions` table (personal budget entries; not business accounting).
- **`shareholder_tx`** → `shareholder_transactions` table (shareholder current-account movements: drawings, repayments, dividends, salary).
- **`journal_entry`** → `journal_entries` table (the actual double-entry bookkeeping records). When a chat tool says "match a bank transaction to a journal entry" it means this kind.

### "Contract" — two distinct meanings
- **subscription** → `contracts` table (recurring spend like Netflix, Adobe, hosting). Sidebar reads "Spend → Subscriptions" (post-rename in #128B). Old `contracts` route redirects to `/subscriptions`.
- **work contract** → `work_contracts` table (client engagements where the business earns income — hourly, fixed-price, retainer). Sidebar reads "Earn → Work Contracts". Tool: `get_work_contracts`.

The schema table names stay as `contracts` and `*_transactions` for now (rename deferred under #121 Option C). Use the prefixed form in chat tool descriptions, UI copy, and PR text.

### Other terms worth pinning
- **"Health Checklist"** (dashboard `/`) — user-facing setup checklist (connect Akahu, set GST basis, add a contact). Different from "System integrity" (`/audit`) which is the technical / app-integrity surface.
- **"PAYE"** in `lib/payroll/calculator.ts` correctly means the COMBINED IRD figure (income tax + ACC earner levy). The income-tax-only piece is exposed as `payeIncomeTax` on `PayCalculationResult`.
