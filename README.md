# Accountaint

Your AI-powered accountant and financial partner for New Zealand businesses. Runs entirely on your own machine — no cloud database, no third-party access to your financial data.

Accountaint acts as your accountant. It gives direct, confident financial advice backed by NZ tax law, manages your books, runs your payroll, optimises your tax position, and handles compliance — without needing an external professional.

## Features

### Core Accounting
- **Double-Entry Ledger** — full chart of accounts, journal entries, trial balance, P&L, and balance sheet
- **Invoicing** — create, send (PDF via email with CC support), and track invoices
- **Expense Tracking** — receipt OCR via local LLM, categorisation, GST handling
- **Bank Reconciliation** — match bank transactions to journal entries, categorise, attach receipts
- **Document Vault** — centralised file storage with folders (Receipts, Bank Receipts, Tax Returns, IRD Guides)

### Payroll
- **Pay Runs** — gross-to-net calculation with PAYE (annualisation method), KiwiSaver, student loan, ESCT
- **Payslip PDF** — professional payslips with YTD summary and leave balances
- **Journal Posting** — automatic balanced journal entries on finalisation
- **NZ Tax Codes** — M, ME, S, SH, SB, ST, SA + student loan variants

### Tax & Compliance
- **NZ Tax Rules** — versioned per tax year (brackets, rates, thresholds) with freshness tracking
- **Tax Optimisation Engine** — AI analyses your financial data against 14+ NZ tax strategies, presents opportunities ranked by dollar saving with risk assessment
- **Regulatory Updates** — monthly AI-powered verification of tax rules against IRD sources
- **GST Calculations** — period-based returns from ledger data
- **Deadline Tracking** — GST, PAYE, provisional tax, income tax, FBT, ACC, annual returns
- **Salary/Dividend Optimiser** — calculates the tax-optimal split for company directors
- **WT Rate Advisor** — recommends the right withholding tax rate for contractors

### AI Assistant
- **Tax & Business Chat** — ask anything about your finances, tax obligations, or NZ tax law
- **Aggressive Tax Optimiser** — proactively suggests legal strategies to minimise your tax burden
- **Natural Language Actions** — "log 6 hours for project work on Tuesday", "invoice the client for last fortnight", "that $12.50 is a software subscription"
- **Web Search** — toggle on for current IRD guidance and tax updates
- **File Attachments** — attach images (processed locally for privacy) and PDFs to chat
- **IRD Knowledge Base** — RAG over official IRD guide PDFs with citations

### Calculators
- **Home Office** — proportional method and square metre rate comparison
- **Motor Vehicle** — mileage rate vs actual cost method
- **FBT** — fringe benefit tax calculation
- **ACC Levies** — earner levy estimation

### Integrations (all optional)
- **Akahu** — NZ open banking for automatic bank transaction sync (ANZ, ASB, BNZ, Westpac, Kiwibank)
- **Xero** — OAuth2 sync for businesses already using Xero (fully optional — the app works entirely without it)
- **NZBN API** — Companies Register lookup for onboarding

### Other
- **Multi-Business** — manage multiple businesses with isolated data (company, sole trader, partnership, trust)
- **Work Contracts** — track client engagements, hourly/fixed/retainer rates, project codes, withholding tax
- **Timesheets** — log hours, weekly view, CSV export in NZ contractor format
- **Shareholder Accounts** — current account tracking, prescribed interest calculations, deemed dividend warnings
- **Asset Register** — fixed assets with depreciation (DV/SL), low-value write-off
- **Personal Budget** — bills, income, debts, savings goals, holiday planning, bank balance sync
- **Notifications** — email (SMTP), desktop push, Slack webhooks

## Privacy & Security

- **All data stays local** — encrypted SQLite database on your machine. No cloud database.
- **PII anonymised** before any AI API calls — names, IRD numbers, bank accounts stripped
- **Local LLM** for privacy-sensitive tasks (receipt OCR, categorisation) — data never leaves your device
- **Encrypted at rest** — sensitive fields (names, IRD numbers, tokens) encrypted with AES-256
- **Integration tokens encrypted** at application level before database storage

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Vector Store | LanceDB (hybrid vector + BM25 search) |
| AI (reasoning) | Claude API — PII-sanitised |
| AI (local) | LM Studio + Qwen3.5-9B — data stays on device |
| Embeddings | Nomic Embed Text V2 (local via LM Studio) |
| AI Tools | Model Context Protocol (MCP) |
| Banking | Akahu (NZ open banking) |
| Accounting | Xero (optional) |
| Auth | Email + PIN with JWT sessions |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/techienz/accountaint-public.git
cd accountaint-public

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env — at minimum you need:
#   APP_ENCRYPTION_KEY (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#   JWT_SECRET (same command, different value)
#   ANTHROPIC_API_KEY (from console.anthropic.com)

# Push the database schema
npx drizzle-kit push

# Start the development server
npm run dev
```

Open [http://localhost:3020](http://localhost:3020) and create your account.

### Optional Setup

- **LM Studio** — install and load Qwen3.5-9B for local receipt OCR and embeddings. Without it, these tasks fall back to Claude with PII sanitisation.
- **Akahu** — register a personal app at [my.akahu.nz](https://my.akahu.nz) for bank transaction sync. Configure in Settings > Bank Feeds.
- **Xero** — create a developer app at [developer.xero.com](https://developer.xero.com) if you want Xero integration. Configure in Settings > Xero.
- **SMTP** — configure email sending in Settings > Notifications for invoice emails and alerts.

## Production Deployment

```bash
# Build for production
npm run build

# Start with systemd or similar
node .next/standalone/server.js
```

Set `DATABASE_PATH` to an absolute path in your `.env` to avoid the standalone build copying the database.

## Documentation

Architecture and design documentation are in the **[GitHub Wiki](https://github.com/techienz/accountaint-public/wiki)**.

## License

This project is not currently licensed for redistribution. All rights reserved.
