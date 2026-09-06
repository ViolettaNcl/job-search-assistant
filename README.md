# Violetta Job Search Assistant

Personal Russia + Europe job-search CRM and application assistant for **Violetta Nicolaou**.

The project is built around one principle: find fewer but stronger opportunities, tailor the application to the actual vacancy, keep every claim truthful, and remove as much repetitive form-filling as possible.

## Current capabilities

- Collects vacancies from **HeadHunter**, **Remotive**, and optionally **Adzuna**.
- Focuses Violetta's search on Russia and Europe with Russia/EU work-authorization awareness.
- Scores each vacancy for C#/.NET fit, junior suitability, eligibility and obvious skill gaps.
- Deduplicates vacancies across sources and maintains one application history per job.
- Tracks New, Saved, Applied, HR Contact, HR Interview, Tech Interview, Test Task, Rejected, Offer and Skipped.
- Generates vacancy-specific Russian or English application drafts using verified candidate facts.
- Repositions truthfully for .NET/backend/full-stack, QA and technical/implementation roles.
- HH OAuth2 + encrypted tokens + resume selection + existing-application import.
- Direct HH submission through HH's official applicant-authorized API for strong jobs after explicit confirmation.
- Chrome extension companion with HH, Greenhouse, Lever, Ashby and generic ATS detection.
- Safe form resolver classifies fields as **fill / review / blocked**.
- Browser-local Application Memory can reuse explicitly confirmed answers such as phone or LinkedIn.
- Secure local **CV Vault** stores the English/Russian PDFs and can insert the recommended CV into ATS upload fields after explicit user action.
- Salary, start-date, relocation, commercial-experience years, legal/security, ID, medical and demographic answers are not blindly automated.
- External vacancies can be saved with their full browser-extracted description, location, remote status, eligibility and calculated match score.
- Daily ranked application queue at **`/queue.html`**.
- Follow-up queue at **`/followups.html`** for Applied jobs that have gone several business days without progress.
- Follow-up attempts are recorded as CRM events and stop surfacing once the vacancy advances beyond Applied.
- Telegram commands and responsive web dashboard.
- PostgreSQL, Docker, GitHub Actions and MSTest.

## Daily workflow

1. Run/visit the Job Search Assistant.
2. Open **`/queue.html`** for the strongest current applications ranked by fit + freshness + eligibility.
3. For HH.ru, use the official API apply flow when available.
4. For Greenhouse, Lever, Ashby or another employer site, open the vacancy and use the Chrome extension.
5. Review the generated message and any fields marked **review** or **blocked**.
6. Upload the recommended CV from CV Vault when appropriate, verify the attachment, and submit the external form yourself.
7. Click **Mark applied** so the CRM stays accurate.
8. Check **`/followups.html`** for applications that are due a polite recruiter follow-up.

The application queue excludes jobs already marked Applied and jobs classified as likely ineligible. The follow-up queue only includes applications still in Applied status; HR contact/interview/rejection/offer states automatically leave the queue.

## Candidate truth source

The `Candidate` section of `src/JobSearchAssistant/appsettings.json` contains the verified non-secret profile used for matching and autofill.

The system knows, among other verified facts, that Violetta has Russian and Cyprus/EU work authorization, speaks Russian/English/Greek, has an honours programming diploma, and has a real-client DentalClinic project. It must never convert project work into invented years of salaried commercial employment.

## Application policy

There is no safe universal candidate API that can submit applications to every employer website.

- **HH.ru:** direct application is supported through an applicant-authorized official API when OAuth and resume selection are configured.
- **External ATS / company sites:** the extension analyzes and safely fills forms, but the final Submit/Apply action remains with the candidate.
- CAPTCHA, 2FA and employer-specific legal declarations are never bypassed.

This avoids account-risky mass-apply automation while still removing most repetitive work.

## Architecture

```text
HH / Remotive / Adzuna ──────────────┐
Browser: HH / Greenhouse / Lever ────┤
Browser: Ashby / other career sites ─┤
                                      ↓
                              vacancy normalization
                                      ↓
                         match + eligibility scoring
                                      ↓
                               PostgreSQL CRM
                          ↙        ↓         ↘
                    Telegram  Dashboard   queues
                                      ↓
                     application draft + field resolver
                               ↙              ↘
                       HH official API      Chrome extension
                                             ↓
                                  autofill + CV Vault
                                             ↓
                                      candidate final submit
                                             ↓
                                      follow-up queue
```

Tech: **.NET 10 LTS, ASP.NET Core Minimal API, EF Core, PostgreSQL, HttpClient, Chrome Manifest V3, Docker, GitHub Actions, MSTest**.

## Setup

For the full Windows + Visual Studio Code walkthrough:

**[`docs/SETUP_VSCODE_RU.md`](docs/SETUP_VSCODE_RU.md)**

Apply Assistant architecture and safety rules:

**[`docs/APPLY_AUTOPILOT_V2.md`](docs/APPLY_AUTOPILOT_V2.md)**

Chrome extension instructions:

**[`browser-extension/README.md`](browser-extension/README.md)**

## Minimal Docker start

```bash
cp .env.example .env
# fill POSTGRES_PASSWORD, TELEGRAM_BOT_TOKEN and ENCRYPTION_KEY_BASE64
docker compose up --build -d
```

Dashboard: `http://localhost:8080`

Daily queue: `http://localhost:8080/queue.html`

Follow-up queue: `http://localhost:8080/followups.html`

## Main API routes

```text
GET  /api/dashboard
GET  /api/application-queue?limit=20&minScore=75
GET  /api/followups?afterBusinessDays=5&maxAttempts=2&limit=30
POST /api/collect
POST /api/extension/analyze
POST /api/extension/resolve-fields
POST /api/import/browser
POST /api/import/hh
POST /api/vacancies/{id}/apply-tailored
POST /api/vacancies/{id}/mark-applied
POST /api/vacancies/{id}/followup-sent
```

## Follow-up behavior

By default, an application becomes due for follow-up after **5 business days** with no progress. The UI lets the user choose the threshold and maximum number of attempts.

When a follow-up is marked sent:

- a `FollowUpSent` CRM event is written;
- the waiting clock restarts from that event;
- the next message becomes a shorter second follow-up;
- after the configured maximum attempts, the job stops appearing;
- if the vacancy moves to HR Contact, interview, rejection or offer, it stops appearing immediately.

The generated follow-up is Russian for Russia/HH applications and English for international applications. It is a draft for review/copying; the system does not silently message recruiters.

## Telegram commands

- `/today` — best new vacancies
- `/best` — top matches
- `/world` — international jobs
- `/applied` — applications
- `/interviews` — interview/test pipeline
- `/stats` — funnel statistics
- `/resumes` — HH resumes
- `/setresume ID` — choose HH resume
- `/sync` — import HH application history
- `/blacklist company` — block company
- `/watch company` — watch company

## Automatic submission

`Security__EnableAutomaticSubmission=false` remains the safe default.

Background automatic submission is deliberately limited. HH's explicit applicant-authorized flow is the supported direct-submit path; external job sites remain review-first.

## Tests

```bash
dotnet test tests/JobSearchAssistant.Tests/JobSearchAssistant.Tests.csproj
```

Tests cover vacancy scoring, application queue ordering, rich browser import, safe application-field resolution and follow-up timing/attempt behavior. CI also validates all Chrome extension JavaScript syntax.

## Deployment

The repository contains `vercel.json` and `Dockerfile.vercel` for Vercel Container Services. The app can start in in-memory demo mode without PostgreSQL, but **do not use the in-memory fallback for real application history**, because container restarts can erase it.

For persistent production use, configure PostgreSQL and the relevant HH/Telegram secrets through environment variables. Never commit access tokens, bot tokens or encryption keys to the repository.

## Next development priorities

- validate and refine ATS selectors against real Greenhouse/Lever/Ashby applications;
- verified profile fields for phone/LinkedIn after explicit user confirmation;
- optional deeper language-model tailoring with a deterministic truthful fallback;
- application outcome analytics by source/role;
- production database migrations and deployment hardening.
