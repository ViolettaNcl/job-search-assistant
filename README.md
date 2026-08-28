# Violetta Global Job Search Assistant

Personal worldwide job-search CRM + Telegram assistant for Violetta Nicolaou.

The system is designed as a **multi-source international platform**, not an HH-only bot. HeadHunter is one adapter; international sources and company career pages are separate adapters feeding the same database and duplicate-protection layer.

## Current capabilities

- Collects C#/.NET vacancies from **HeadHunter**, **Remotive**, and optionally **Adzuna**.
- Searches international remote roles and selected country markets including the US, UK, Germany, Canada, Australia and Europe.
- Calculates both **technical Match Score** and a separate **Eligibility** hint for geography/work authorization.
- Flags obvious restrictions such as `US only`, `must be authorized to work in the United States`, and `no sponsorship`.
- Gives priority signals to `Worldwide`, `Anywhere`, `visa sponsorship`, and `relocation support`.
- Deduplicates the same vacancy inside a source and across multiple aggregators.
- Maintains one company history across sources, so previous applications remain visible.
- Tracks: New, Saved, Applied, HR Contact, HR Interview, Tech Interview, Test Task, Rejected, Offer, Skipped.
- Telegram commands and inline buttons.
- Web dashboard at `/`.
- HH OAuth2 + encrypted tokens + existing-application import + official HH apply endpoint.
- External jobs open the official/source application URL and have a one-click **Mark Applied** action.
- Blacklist and watchlist companies.
- Docker, PostgreSQL, GitHub Actions, MSTest.

## Important application policy

There is no safe universal candidate API that can submit a resume to every job board worldwide.

- HH supports applicant OAuth and application APIs, so direct submission is supported there.
- Greenhouse and Lever have application APIs, but submission requires credentials/API keys controlled by the employer account, not a random candidate.
- LinkedIn prohibits unauthorized bots/scraping/automated activity.
- Other platforms have their own terms and application flows.

Therefore the global mode uses **official APIs where candidate submission is genuinely available**, and otherwise opens the official apply page and records the application after user confirmation. This protects the account from duplicate/spam submissions and platform bans.

## Architecture

```text
HH API ────────────────┐
Remotive API ──────────┤
Adzuna country APIs ───┤
Manual/ATS links ──────┼──> JobService
                       │       ↓
                       │  cross-source dedup
                       │       ↓
                       │ match + eligibility
                       │       ↓
                       └──> PostgreSQL
                              ↙      ↘
                         Telegram   Dashboard
                              ↓
                  API apply or official apply URL
```

Tech: .NET 10 LTS, ASP.NET Core Minimal API, EF Core, PostgreSQL, HttpClient, Docker, GitHub Actions, MSTest.

## Setup

For a complete Windows + **Visual Studio Code** walkthrough see:

**[`docs/SETUP_VSCODE_RU.md`](docs/SETUP_VSCODE_RU.md)**

International architecture and roadmap:

**[`docs/INTERNATIONAL_MODE_RU.md`](docs/INTERNATIONAL_MODE_RU.md)**

## Minimal Docker start

```bash
cp .env.example .env
# fill POSTGRES_PASSWORD, TELEGRAM_BOT_TOKEN and ENCRYPTION_KEY_BASE64
docker compose up --build -d
```

Dashboard: `http://localhost:8080`

## Telegram commands

- `/start` — help
- `/today` — best new vacancies from all sources
- `/best` — top matches
- `/world` — international/non-HH jobs
- `/sources` — source counts
- `/applied` — applications
- `/interviews` — interview/test pipeline
- `/stats` — funnel statistics
- `/resumes` — HH resumes
- `/setresume ID` — choose HH resume
- `/sync` — import existing HH application history
- `/blacklist company` — block company
- `/watch company` — watch company
- send an HH URL — rich import through HH API
- send any other job URL — store it in the unified CRM without duplicating the same URL

## International sources

### Remotive

Enabled by default; no API key required. Remotive requires attribution and linking back to the source job URL. Its public API feed may be delayed compared with live listings.

### Adzuna

Disabled until credentials are configured. Register at `https://developer.adzuna.com/`, then set:

```env
ADZUNA_ENABLED=true
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
```

Default country codes are configurable in `appsettings.json`.

### HeadHunter

HH can be used as another source before OAuth. Personal response history and direct application require applicant OAuth.

## Automatic submission

`ENABLE_AUTOMATIC_SUBMISSION=false` by default.

Current automatic submission is intentionally limited to HH because the system has a real applicant-authorized API there. International external sources never receive blind background submissions. For them the user opens the official application URL, completes any employer-specific questions, and clicks `✅ Я откликнулась` / `Mark Applied`.

## Tests

```bash
dotnet test tests/JobSearchAssistant.Tests/JobSearchAssistant.Tests.csproj
```

Tests include strong-match scoring, Senior/Lead penalties, missing skills, and US-only work-authorization filtering.

## Roadmap

1. Public **Greenhouse / Lever / Ashby** readers for a configurable list of watched international companies.
2. English Backend and Full-Stack CV variants with automatic recommendation of which one to use.
3. Cover-letter generation with preview/approval.
4. Email application adapter where the employer explicitly accepts email CVs.
5. Calendar/interview reminders and reply ingestion.
6. EF Core migrations before long-term production use.

## Remote-only markets and employment types

The assistant treats Russia and the international market as two equal search tracks. It does not hide Russian opportunities behind international feeds and keeps a single deduplicated CRM across sources.

**Markets**
- 🇷🇺 Russia — primarily HeadHunter remote vacancies and internships.
- 🌍 International — Remotive, Adzuna and manually added company/career-site vacancies.

**Accepted remote employment types**
- 💼 Remote Full-Time
- 🤝 International Contractor / B2B
- 🧩 Freelance / Project
- 🎓 Internship / Trainee / Graduate

Hybrid and on-site positions are intentionally excluded when `Search:RemoteOnly=true`.

### Dashboard navigation

The dashboard has dedicated views for **All**, **Russia**, **International**, **Internships**, **Strong Match**, and **Applications**, plus a separate employment-type filter and a job/company search field. The UI is responsive and optimized for quick daily review rather than displaying every source as one long feed.

## Vercel deployment

The repository now includes `vercel.json` and `Dockerfile.vercel` for Vercel Container Services.
The container listens on Vercel's `$PORT`. If `ConnectionStrings__Postgres` is not configured,
the application starts in an **in-memory demo mode** so the dashboard can be deployed and verified.
For real application tracking, connect a persistent PostgreSQL database (recommended: Neon via the
Vercel Marketplace) and set `ConnectionStrings__Postgres` in Production/Preview environment variables.

Recommended production environment variables:

```text
ConnectionStrings__Postgres=postgresql connection string
Telegram__BotToken=...
Telegram__AllowedChatId=...
HH__Enabled=true
HH__ClientId=...
HH__ClientSecret=...
HH__RedirectUri=https://YOUR-PROJECT.vercel.app/api/hh/oauth/callback
Remotive__Enabled=true
Adzuna__Enabled=false
Adzuna__AppId=...
Adzuna__AppKey=...
Security__EncryptionKeyBase64=...
Security__EnableAutomaticSubmission=false
```

Do not use the in-memory fallback for real application history: container restarts can erase it.
