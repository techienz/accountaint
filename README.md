# Accountaint

> ## ⚠️ Not financial, tax, or legal advice — use at your own risk
>
> **Accountaint can get things wrong.** It uses AI to answer tax questions and applies NZ tax rules from code that may have bugs, drift behind IRD changes, or misinterpret your specific situation. The figures it produces — GST returns, IR3/IR4 calculations, salary/dividend optimisation, RWT, deadlines — are estimates, not authoritative filings.
>
> **You are responsible for the numbers you file.** Before relying on any output for filing with IRD, the Companies Office, ACC, or any other authority:
>
> - **Verify against your own records.** Hand-calc at least one transaction or scenario and confirm it matches what the app says.
> - **Cross-check with IRD's published guidance** (ird.govt.nz) — the canonical source for any tax rate or due date.
> - **Consult a chartered accountant or registered tax agent** for anything material — especially first-year filings, mid-year changes (entity type, balance date, GST registration), and any unusual transaction.
>
> The authors and contributors accept no liability for incorrect filings, missed deadlines, penalties, or any other loss arising from use of this software. If you are not comfortable verifying tax figures yourself, **do not use this app to file your taxes** — use a registered NZ accountant instead.
>
> By using Accountaint you agree to use it at your own risk.

---

Self-hosted, AI-powered accounting app for New Zealand businesses. Your financial data stays on your machine, encrypted at rest. Claude handles reasoning (with PII sanitisation), an optional local LLM handles sensitive tasks like OCR and categorisation.

## Highlights

- **Local-first** — SQLite + LanceDB on your disk; no cloud database
- **AI chat that is your accountant** — direct, confident answers backed by NZ tax law and IRD guidance (RAG)
- **Double-entry bookkeeping engine** — Chart of Accounts, journal entries, Trial Balance, P&L, Balance Sheet, General Ledger
- **Bank feeds via Akahu** — NZ banks; ANZ/ASB/BNZ/Westpac live, Kiwibank via Akahu from Dec 2026
- **Xero is optional** — use it for parallel running and cross-check, or don't use it at all
- **Dividends** — declare, generate board resolution PDFs (Companies Act 1993 s107), post journal entries
- **Payroll** — PAYE, KiwiSaver, student loan, ESCT, payslips
- **GST** — returns from the ledger (includes expenses, not just invoices)
- **Multi-tenant** — multiple businesses per user with isolated data
- **Privacy first** — PII encrypted at rest; sanitised before leaving the machine

## Deployment

Two supported options. Pick one:

### Option A: Docker (recommended for new installs)

```bash
# 1. Pull the compose file
curl -O https://raw.githubusercontent.com/techienz/accountaint/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/techienz/accountaint/main/.env.docker.example

# 2. Copy the env template and fill in secrets
cp .env.docker.example .env
# Edit .env — set APP_ENCRYPTION_KEY, JWT_SECRET, ANTHROPIC_API_KEY, VAPID_* keys.
# See comments in .env.docker.example for how to generate each.

# 3. Prepare the data directory (must be UID 1000)
mkdir -p data && sudo chown -R 1000:1000 data

# 4. Start it
docker compose up -d
```

Open http://localhost:3000 and follow the **First-run guide** below.

Image is published at `ghcr.io/techienz/accountaint`. Tags: `:latest`, `:main`, `:v0.1.0`, `:sha-<short>`.

To rebuild from source instead of pulling, clone the repo and in `docker-compose.yml` replace `image: …` with `build: .`.

**Local LLM note:** if LM Studio or Ollama is running on the host, use `host.docker.internal:PORT` as the URL (either in `.env` or via Settings → Local LLM in-app). If LM Studio isn't running at all, the app falls back to Claude Haiku with PII sanitisation — functional but less private.

#### Drop-in compose example (Portainer-friendly)

Self-contained stack — paste into a Portainer stack editor or a standalone `docker-compose.yml` and fill in the placeholder values. No separate `.env` file needed.

```yaml
services:
  accountaint:
    image: ghcr.io/techienz/accountaint:latest
    container_name: accountaint
    restart: unless-stopped
    init: true                    # reaps Chromium zombie processes
    shm_size: "1gb"               # Chromium needs more than the default 64MB
    ports:
      - "3000:3000"
    environment:
      # ─── Required secrets ─────────────────────────────────────────────────
      # Generate each 32-byte key with:
      #   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
      APP_ENCRYPTION_KEY: "REPLACE_WITH_32_BYTE_HEX"
      JWT_SECRET: "REPLACE_WITH_32_BYTE_HEX"
      ANTHROPIC_API_KEY: "sk-ant-…"

      # Web-push VAPID keys (for desktop notifications)
      # Generate with: npx web-push generate-vapid-keys
      VAPID_PUBLIC_KEY: "REPLACE_ME"
      VAPID_PRIVATE_KEY: "REPLACE_ME"
      VAPID_EMAIL: "mailto:you@example.com"

      # ─── Local LLM (optional) ─────────────────────────────────────────────
      # Uncomment and point at your local LLM. Values set in-app via
      # Settings → Local LLM override these.
      # LMSTUDIO_URL: "http://host.docker.internal:1234/v1"
      # LMSTUDIO_CHAT_MODEL: "qwen3.5-9b"
      # LMSTUDIO_EMBEDDING_MODEL: "nomic-ai/nomic-embed-text-v2-moe"

      # ─── Xero (optional, only for parallel running) ───────────────────────
      # XERO_CLIENT_ID: ""
      # XERO_CLIENT_SECRET: ""
      # XERO_GRANT_TYPE: "client_credentials"
    volumes:
      - accountaint-data:/data
    # Uncomment on Linux if the Local LLM on the host is unreachable via
    # host.docker.internal — this maps it to the host gateway explicitly.
    # extra_hosts:
    #   - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      start_period: 20s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  accountaint-data:
```

**Notes:**
- Named volume (`accountaint-data`) — Portainer manages it, no host-path UID issues. For bind-mount instead (so you can back up the files directly), replace with `./data:/data` and make sure the host directory is owned by UID 1000.
- Port mapping — change the left side of `3000:3000` to expose on a different host port (e.g. `3020:3000` to match an existing reverse-proxy config).
- HTTPS — put a reverse proxy (Nginx, Caddy, Traefik, Nginx Proxy Manager) in front. The app itself serves plain HTTP on port 3000.
- Updating — in Portainer: Stack → Editor → Update → tick "Re-pull image". On CLI: `docker compose pull && docker compose up -d`.

### Option B: Systemd user service (direct on host)

For long-running installs where you already manage the Node process directly.

```bash
git clone https://github.com/techienz/accountaint.git
cd accountaint
npm ci
cp .env.example .env        # fill in secrets
npx drizzle-kit push        # create DB schema
npm run build
# Either `npm start` or configure a systemd user service pointing at
# `.next/standalone/server.js`.
```

A sample systemd user unit file and Nginx reverse-proxy config for HTTPS are in the wiki.

## First-run guide

After starting the app, visit `http://localhost:3000` and do the following in order:

1. **Create your account** — set an email and 4-digit PIN. The first account becomes the owner.
2. **Add your first business** — Overview → Settings → business details. Pick entity type (company, sole trader, partnership, trust), GST period, GST basis, balance date.
3. **Bank Feeds (recommended)** — Settings → Bank Feeds. Paste your Akahu **App ID Token** and **User Access Token** from [my.akahu.nz](https://my.akahu.nz). Click "Sync Now" to pull accounts and transactions. Link each bank account to either "Personal Budget" or your business.
4. **Local LLM (optional)** — Settings → Local LLM. Pick a preset (LM Studio or Ollama), Test Connection, Save. Without this, OCR/categorisation/summarisation fall back to Claude Haiku.
5. **IRD knowledge base** — Settings → Regulatory Updates → "Fetch IRD guides". Downloads the IRD guides used for RAG-backed tax advice. Takes 30 seconds to a couple of minutes.
6. **Shareholders / Employees** — Earn → Shareholders, or People → Employees. Add IRD numbers, ownership %, start dates, pay details.
7. **Opening Balances (if migrating from Xero)** — Settings → Opening Balances. Imports your balance sheet starting point so the ledger gives accurate reports from day one.
8. **Xero (optional, for parallel running)** — Settings → Xero. OAuth2 flow connects a company. Use Xero Monitor to compare ledger vs. Xero while you gain confidence in the local ledger.
9. **Notifications (optional)** — Settings → Notifications. Configure email, desktop push, or Slack alerts for deadlines.
10. **Tax Savings bank link (optional)** — Settings → Bank Feeds. Check "Tax Savings" on the account you use for tax set-aside. The tracker reads its balance automatically.

You're ready to go. The AI chat (click the icon top-right) can walk you through anything else.

## Documentation

Full architecture, design decisions, and knowledge system docs live in the **[wiki](https://github.com/techienz/accountaint/wiki)**:

- [Architecture](https://github.com/techienz/accountaint/wiki/Architecture)
- [Design Decisions](https://github.com/techienz/accountaint/wiki/Design-Decisions)
- [Database Schema](https://github.com/techienz/accountaint/wiki/Database-Schema)
- [NZ Tax Knowledge](https://github.com/techienz/accountaint/wiki/NZ-Tax-Knowledge)
- [Xero Integration](https://github.com/techienz/accountaint/wiki/Xero-Integration)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, standalone output) |
| UI | Tailwind CSS + shadcn/ui |
| Database | SQLite via better-sqlite3 + Drizzle ORM; application-level field encryption |
| Vector Store | LanceDB (hybrid vector + BM25) |
| AI (reasoning) | Claude Sonnet API with PII sanitisation |
| AI (local) | Any OpenAI-compatible local LLM (LM Studio, Ollama, vLLM, llama.cpp) |
| Embeddings | Nomic Embed Text V2 via local LLM |
| PDF generation | Puppeteer (invoices, payslips, board resolutions) |
| Auth | Email + 4-digit PIN with JWT sessions |

## Prerequisites

For Docker deployment: Docker 20+ and Docker Compose v2.

For direct deployment: Node.js 22+ and npm 10+.

In either case:
- **Claude API key** — [console.anthropic.com](https://console.anthropic.com/)
- **Akahu personal app tokens** (recommended) — [my.akahu.nz](https://my.akahu.nz)
- **LM Studio or Ollama** (optional, for local AI)
- **Xero developer app** (optional, only if you want parallel running)

## License

Not currently licensed for redistribution. All rights reserved.
