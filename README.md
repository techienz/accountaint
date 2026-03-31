# Accountaint

AI-powered accounting assistant for New Zealand businesses. Runs locally, integrates with Xero, and provides NZ tax compliance guidance — all while keeping your financial data on your own machine.

<!-- ![Accountaint screenshot](docs/screenshot.png) -->

## Features

- **Xero Integration** — OAuth2 connection with automatic syncing of invoices, bank transactions, contacts, and more
- **AI Chat Assistant** — Ask tax and accounting questions with answers grounded in official IRD guidance via RAG
- **NZ Tax Compliance** — Versioned tax rules, GST calculations, provisional tax, PAYE, FBT, and deadline tracking
- **Multi-Business Support** — Manage multiple businesses (company, sole trader, partnership, trust) with isolated data
- **Business Snapshot** — Dashboard with key metrics, cash position, receivables/payables, and tax obligations
- **Expense Tracking** — Receipt OCR, categorisation, and Xero reconciliation
- **Contract Management** — Track contracts, renewals, and subscription costs
- **Shareholder Accounts** — Current account tracking with salary/dividend optimisation
- **Calculators** — Home office, vehicle, FBT, and ACC levy calculators
- **Cross-Check** — Detect changes in Xero data and flag anomalies
- **Notifications** — Email, desktop push, and Slack alerts for deadlines and events
- **Privacy First** — All data stored locally in encrypted SQLite; PII anonymised before any cloud API calls

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Database | SQLite (SQLCipher encryption) + Drizzle ORM |
| Vector Store | LanceDB (hybrid vector + BM25 search) |
| AI (reasoning) | Claude API (Sonnet) — PII-sanitised |
| AI (local) | LM Studio + Qwen3.5-9B — data stays on device |
| Embeddings | Nomic Embed Text V2 (local via LM Studio) |
| AI Tools | Model Context Protocol (MCP) |
| Auth | Email + PIN with JWT sessions |

## Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Xero Developer App** — for Xero integration ([create one here](https://developer.xero.com/app/manage))
- **Claude API Key** — for AI chat ([get one here](https://console.anthropic.com/))
- **LM Studio** (optional) — for local LLM and embeddings; falls back to Claude Haiku with PII sanitisation if unavailable

## Quick Start

```bash
# Clone the repo
git clone https://github.com/techienz/accountaint-public.git
cd accountaint-public

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your keys (see comments in .env.example for guidance)

# Generate encryption keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output into APP_ENCRYPTION_KEY and JWT_SECRET in .env

# Push the database schema
npx drizzle-kit push

# Start the development server
npm run dev
```

Open [http://localhost:3020](http://localhost:3020) in your browser to get started.

## Documentation

Full architecture, design decisions, and knowledge system documentation are in the **[GitHub Wiki](https://github.com/techienz/accountaint-public/wiki)**:

- [Architecture](https://github.com/techienz/accountaint-public/wiki/Architecture) — system diagram, tech stack, data flow
- [Design Decisions](https://github.com/techienz/accountaint-public/wiki/Design-Decisions) — rationale for every architectural choice
- [Database Schema](https://github.com/techienz/accountaint-public/wiki/Database-Schema) — schema design
- [NZ Tax Knowledge](https://github.com/techienz/accountaint-public/wiki/NZ-Tax-Knowledge) — 3-layer knowledge system
- [Xero Integration](https://github.com/techienz/accountaint-public/wiki/Xero-Integration) — OAuth2 flow, sync strategy
- [Setup Guide](https://github.com/techienz/accountaint-public/wiki/Setup-Guide) — detailed installation and configuration

## License

This project is not currently licensed for redistribution. All rights reserved.
