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
- Optional all-day HH Apply Autopilot through the Chrome extension and the candidate's existing HH website session; official HH API access remains an optional alternative.
- Chrome extension companion with HH, Greenhouse, Lever, Ashby and generic ATS detection.
- Safe form resolver classifies fields as **fill / review / blocked**.
- Browser-local Application Memory can reuse explicitly confirmed answers such as phone or LinkedIn.
- Candidate profile supports verified **Phone** and **LinkedInUrl** slots; configured values take precedence over stale browser memory.
- Extension shows profile readiness before applying and flags missing verified contact facts instead of guessing them.
- Secure local **CV Vault** stores the English/Russian PDFs and can insert the recommended CV into ATS upload fields after explicit user action.
- Salary, start-date, relocation, commercial-experience years, legal/security, ID, medical and demographic answers are not blindly automated.
- External vacancies can be saved with their full browser-extracted description, location, remote status, eligibility and calculated match score.
- Daily ranked application queue at **`/queue.html`**.
- Follow-up queue at **`/followups.html`** for Applied jobs that have gone several business days without progress.
- Follow-up attempts are recorded as CRM events and stop surfacing once the vacancy advances beyond Applied.
- Outcome analytics at **`/analytics.html`** for response/interview/offer rates by source, market, role type, match-score band and CV variant.
- External CV attribution records a filename only when the extension actually inserted that PDF before the application was marked Applied.
- Persistent PostgreSQL uses EF migrations; existing pre-migration databases are adopted by the idempotent baseline migration.
- Liveness/readiness endpoints and container health checks protect production startup.
- Telegram commands and responsive web dashboard.
- PostgreSQL, Docker, GitHub Actions and MSTest.

## Two working modes

1. **Autonomous HH mode:** start the Windows program, sign in to HH.ru in the Chrome profile containing the extension, then press **Запустить AI-ассистента** on the dashboard. The extension connects automatically, so Client ID and Client Secret are not required. It refreshes the vacancy feed, opens eligible non-senior HH jobs above the chosen score, selects the website resume, sends the short description-specific letter in HH's second cover-letter step, respects the daily limit and records every confirmed result.
2. **Manual browser mode:** keep the backend running, open any vacancy in Chrome and press **Отправить отклик + письмо** in the extension. It analyzes the job, creates the letter, selects the HH resume or stored CV, fills safe fields and presses the unambiguous final action. It stops when a required answer, CAPTCHA, legal declaration or ambiguous button needs the candidate.

The dashboard pipeline shows the employer, vacancy, source, application time, manual/autopilot origin, cover-letter status and later HR/interview/rejection/offer updates.

The application queue excludes jobs already marked Applied and jobs classified as likely ineligible. The follow-up queue only includes applications still in Applied status; HR contact/interview/rejection/offer states automatically leave the queue.

## Candidate truth source

The `Candidate` section of `src/JobSearchAssistant/appsettings.json` contains the verified non-secret profile used for matching and autofill.

The system knows, among other verified facts, that Violetta has Russian and Cyprus/EU work authorization, speaks Russian/English/Greek, has an honours programming diploma, and has a real-client DentalClinic project. It must never convert project work into invented years of salaried commercial employment.

The verified phone number is configured in the local profile. `LinkedInUrl` remains blank until Violetta explicitly confirms it. Configured values are authoritative; unknown values stay for review instead of being guessed.

## Application policy

There is no safe universal candidate API that can submit applications to every employer website.

- **HH.ru:** the default background autopilot uses the logged-in Chrome session; applicant-authorized API submission is used only when it was configured explicitly. Both modes submit only verified eligible jobs and protect against duplicates.
- **External ATS / company sites:** the extension can perform the final click from the explicit **Отправить отклик + письмо** action when the form, CV and confirmation signal are unambiguous. It stops for unknown mandatory answers or unclear site state.
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
                      ↙          ↓          ↘
                Telegram     Dashboard     queues
                               ↓     ↘
                 application draft   outcome analytics
                         + field resolver
                       ↙              ↘
               HH official API      Chrome extension
                                     ↓
                       verified profile + memory
                                     ↓
                              autofill + CV Vault
                                     ↓
                              candidate final submit
                                     ↓
                         follow-up + CV attribution
```

Tech: **.NET 10 LTS, ASP.NET Core Minimal API, EF Core, PostgreSQL, HttpClient, Chrome Manifest V3, Docker, GitHub Actions, MSTest**.

## Setup

To run directly from the source archive on Windows, install the .NET 10 SDK and double-click **`START_FROM_SOURCE.cmd`**. The dashboard opens at `http://127.0.0.1:8080`; keep the backend terminal open while the assistant is working.

For the full Windows + Visual Studio Code walkthrough:

**[`docs/SETUP_VSCODE_RU.md`](docs/SETUP_VSCODE_RU.md)**

Apply Assistant architecture and safety rules:

**[`docs/APPLY_AUTOPILOT_V2.md`](docs/APPLY_AUTOPILOT_V2.md)**

Chrome extension instructions:

**[`browser-extension/README.md`](browser-extension/README.md)**

Database migration/upgrade policy:

**[`docs/DATABASE_MIGRATIONS.md`](docs/DATABASE_MIGRATIONS.md)**

## Minimal Docker start

```bash
cp .env.example .env
# fill POSTGRES_PASSWORD, TELEGRAM_BOT_TOKEN and ENCRYPTION_KEY_BASE64
docker compose up --build -d
```

Dashboard: `http://localhost:8080`

Daily queue: `http://localhost:8080/queue.html`

Follow-up queue: `http://localhost:8080/followups.html`

Outcome analytics: `http://localhost:8080/analytics.html`

Liveness: `http://localhost:8080/health/live`

Readiness: `http://localhost:8080/health/ready`

## Main API routes

```text
GET  /api/candidate
GET  /api/dashboard
GET  /api/application-queue?limit=20&minScore=75
GET  /api/followups?afterBusinessDays=5&maxAttempts=2&limit=30
GET  /api/analytics/outcomes
GET  /api/automation/status
GET  /api/applications/activity?limit=100
POST /api/collect
POST /api/automation/run
POST /api/settings/autoapply
POST /api/extension/analyze
POST /api/extension/resolve-fields
POST /api/import/browser
POST /api/import/hh
POST /api/vacancies/{id}/apply-tailored
POST /api/vacancies/{id}/mark-applied
POST /api/vacancies/{id}/cv-attribution?resumeLabel=...
POST /api/vacancies/{id}/followup-sent
```

## Outcome analytics behavior

The analytics screen reports response, interview and offer rates across source, market, role type, score band and CV variant.

- `Applied` by itself is still waiting and does **not** count as a response.
- HR Contact, interview stages, rejection and offer count as recruiter responses.
- HR Interview, Tech Interview, Test Task and Offer count toward interview progression.
- The UI displays small samples, but “strongest signal” callouts require at least **3 applications** in that segment.
- External CV filenames are attributed only when the extension actually inserted that PDF into the application page. Manual/unknown uploads remain **CV not recorded** instead of being guessed.
- HH applications remain grouped under the selected HH resume path rather than pretending the browser CV Vault was used.

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
- `/followups` — applications due a recruiter follow-up
- `/interviews` — interview/test pipeline
- `/stats` — funnel statistics
- `/resumes` — HH resumes
- `/setresume ID` — choose HH resume
- `/sync` — import HH application history
- `/blacklist company` — block company
- `/watch company` — watch company

## Automatic submission

Apply Autopilot is off until the user starts it from the local dashboard. The start/pause choice persists in the local database, so an enabled autopilot resumes after restarting the program. In the default browser mode, Chrome and the installed extension must stay open with an active HH login; no developer credentials are required. New installations default to an 85/100 priority threshold and 25 applications per local calendar day; the dashboard supports 50–100 and 1–200 per day. The index is not a hiring probability.

Background submission is deliberately HH-only and never uses LinkedIn. External employer forms need an open browser tab and the extension's explicit one-click action.

## Tests

```bash
dotnet test tests/JobSearchAssistant.Tests/JobSearchAssistant.Tests.csproj
```

Tests cover vacancy scoring, application queue ordering, rich browser import, safe application-field resolution, verified profile readiness, follow-up timing/attempt behavior, CV attribution, runtime readiness and outcome analytics. CI also validates all Chrome extension JavaScript and inline dashboard/queue/analytics JavaScript syntax.

## Deployment

The repository contains `vercel.json` and `Dockerfile.vercel` for Vercel Container Services. The app uses persistent local SQLite when PostgreSQL is not configured. On container hosting, configure PostgreSQL or a persistent volume for SQLite; an ephemeral container filesystem cannot preserve application history across replacements.

Persistent PostgreSQL startup applies registered EF migrations automatically. The container exposes `/health/live` and database-aware `/health/ready`; Docker health checks use readiness. For persistent production use, configure PostgreSQL and the relevant HH/Telegram secrets through environment variables. Never commit access tokens, bot tokens or encryption keys to the repository.

## Next development priorities

Current priority: qualified **fully remote** HH applications with a short evidence-grounded letter. Version 2.7.5 makes remote-only the default again, following Violetta's explicit preference. Automatic queues and API submission also exclude old non-remote records and contradictory mandatory-office descriptions. Unknown remote format is not treated as remote. Explicit `Search:RemoteOnly=false` remains a manual search override; unattended applications still require remote work.

Completed foundations:
- immediate qualified application after browser discovery, existing-queue processing before another search, pause/quota rechecks and confirmed resume + letter receipts (2.7.4);
- discovery and submission timestamps, review reasons and live application journal (2.7.4);
- configured contact email in letters; phone and private answers stay in local configuration;
- configurable review-only AI provider plus deterministic evidence-grounded writing;
- screening review with a prioritized action list: mandatory skill/experience/education gaps, eligibility review, verified skills missing from pasted CV text, and unsupported claims requiring confirmation (2.7.5).

Remaining release gates, in order:
1. Run an authenticated HH pilot on eligible remote vacancies and record actual confirmed submissions, letter failures, review stops and duplicates. Unit/fixture tests are not a production-success rate. HH access restrictions and unknown employer questions require user action.
2. Validate current HH work-format fields and resume/letter controls against accessible live pages. Description/structured-data extraction is conservative; an unrecognized format must not silently become remote.
3. Add a local SQLite backup/restore workflow and perform a restore drill before expanding unattended usage with substantial history. Existing restart tests prove persistence, not backup recovery.
4. Use recruiter responses and interviews to assess application quality once the minimum sample size is met. The employer's rejection reason remains unknown unless supplied by the employer.
5. Consider further platforms only after the HH pilot meets its gates. LinkedIn is excluded. Production hosting/PostgreSQL deployment is deferred until separately requested; no Vercel deployment is part of this release.

ATS preparation means clear, truthful, relevant CV content. It cannot guarantee passing a recruiter's private filters. Pasted resume text is compared locally and is not automatically written into the selected HH resume.
