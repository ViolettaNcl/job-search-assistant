# Astra Handoff — Violetta Apply Assistant

Use this file as the authoritative continuation brief. **Do not restart, redesign, or rebuild the project from scratch. Continue from current `main`.**

## Exact continuation point

- Repository: `https://github.com/ViolettaNcl/job-search-assistant`
- Current verified main commit at handoff: `c2a5fb9b41fdf312b62260dd93b673ac8ae706a4`
- Current Windows pilot release: **2.4.1**
- Latest merged hotfix: PR #39 — `Pilot hotfix v2.4.1: fix SQLite application queue 500`
- PR #32 (`feat/pipeline-desk-v20`) was intentionally closed as obsolete because it diverged from current main. If Pipeline Desk is still desirable, rebuild it from current `main`; never merge or revive the old branch.

Before doing any work, fetch current `main` again. If `main` has advanced beyond the SHA above, the newer `main` wins.

## User goal

Build and operate a practical job-search/application assistant for **Violetta Nicolaou / Виолетта Николау** that makes strong junior applications across **Russia + Europe** as fast and low-friction as possible without inventing candidate facts or blindly mass-applying.

**USA is out of scope.**

Primary role families:

- Junior C# / .NET / ASP.NET Core / backend / full-stack
- Associate / Graduate Software Engineer
- .NET internships
- Junior QA / QA Automation
- Junior Implementation
- Technical / Application Support

Remote-first. Russia and EU work authorization are both true.

## Candidate truth source — do not fabricate

Identity:

- English: Violetta Nicolaou
- Russian: Виолетта Николау
- Greek: Βιολέττα Νικολάου
- Email: `violettanicolaou@gmail.com`
- Current location: Volgograd, Russia
- GitHub: `https://github.com/ViolettaNcl`
- Portfolio/CV site: `https://violetta-cv.vercel.app/`
- English CV: `Violetta_Nicolaou_CV_EN_v2.pdf`
- Russian CV: `Violetta_Nicolaou_CV_RU_v2.pdf`
- Education: `09.02.07 Information Systems and Programming — Programmer, honours diploma, TOP Academy, July 2026`
- Russia work authorization: true
- EU work authorization: true
- Citizenships: Russia; Cyprus/EU
- Fluent: Russian, English, Greek
- French: beginner

Experience rules:

- No salaried/formal developer employment yet.
- This is her **first formal developer role**.
- If forced to state commercial development experience: **less than 1 year / first formal developer role, with real project experience**.
- Do not invent years of commercial experience.
- Do not claim MediatR or CQRS unless repository evidence is found later.
- DentalClinic is an **independent real-client project**, not salaried employment.

Main project:

- `https://github.com/ViolettaNcl/DentalClinic`
- ASP.NET Core, EF Core, SQL Server, JWT, SignalR, background jobs, Docker, tests, AI integrations.

Core skills include C#, .NET, ASP.NET Core, Web API, EF Core, SQL Server/SQL, REST, LINQ, Docker, Git/GitHub Actions, MSTest/xUnit, JavaScript/TypeScript, React/Next.js, SignalR, JWT, WPF/XAML.

Phone and LinkedIn are intentionally **not committed to GitHub**. They are entered in the extension's local contact profile and stored in `chrome.storage.local` application memory.

## Current product state

### Backend / persistence

- ASP.NET Core / .NET 10.
- Zero-setup Windows mode uses persistent local SQLite by default.
- Default DB path: `%LOCALAPPDATA%\ViolettaApplyAssistant\jobassistant.db`.
- PostgreSQL remains supported when configured.
- Separate `/health/live` and `/health/ready` endpoints exist.
- Windows self-contained packaging is verified.

### Background automation already running

When the backend is started, `VacancyCollectorWorker` starts automatically after roughly **15 seconds** and then runs repeatedly.

Current default collection interval: **360 minutes (6 hours)**.

It searches/imports through configured sources and refreshes the ranked queue. This is the job-discovery automation. Keep it reliable and observable.

Do **not** silently enable blind application submission. External ATS final Submit/Apply remains candidate-controlled. HH direct submission may use the official applicant API only after valid OAuth/resume setup and the intended confirmation/safety gates.

### Current application workflow

The Chrome MV3 extension currently supports:

1. vacancy extraction and structured `JobPosting` JSON-LD
2. ATS detection/adapters including HH, Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Teamtailor, Recruitee, Workable and Personio
3. truthful match scoring / eligibility
4. vacancy-specific EN/RU application draft
5. safe field resolution (`fill`, `review`, `blocked`)
6. local reusable phone/LinkedIn profile
7. CV Vault with one-time local PDF setup
8. explicit recommended CV insertion
9. persisted-fill verification after React/ATS state settles
10. multi-step ATS session persistence
11. application-stage intelligence
12. one-click **Prepare application**
13. **Review Navigator** for unresolved fields
14. candidate confirmation fingerprints without storing sensitive answers
15. conservative Final Review Gate
16. employer Submission Receipt detection + explicit CRM recording
17. ranked Daily Queue
18. post-submission **Continue to next strong job**
19. Follow-up Desk and follow-up queue
20. outcome analytics
21. Windows Setup & Readiness center

### Application thresholds

- 85–100: Apply now
- 75–84: Apply
- 65–74: Review
- <65: Skip

Do not turn this into blind mass applying. Prefer strong, truthful applications.

## First real-PC pilot finding — FIXED

The first live Windows test showed:

`Queue returned 500.`

Root cause: `ApplicationQueueService` attempted SQL ordering using `DateTimeOffset` (`PublishedAt ?? FirstSeenAt`), which worked with PostgreSQL/in-memory tests but failed under SQLite/EF Core.

PR #39 fixed this by removing the incompatible SQL `DateTimeOffset` ordering and retaining final freshness/eligibility priority calculation in memory. A real SQLite regression test was added. Release bumped to **2.4.1**.

Do not regress this fix.

The same pilot screenshot showed `7 review`, `0 safe fields verified`, and `no CV upload field detected on this stage`. Treat those as conservative states, not automatically as bugs. Investigate only with the actual ATS page/form context. A later stage may contain the CV field.

## Mandatory autonomous engineering workflow

When continuing development:

1. Fetch current `main` and inspect existing behavior before proposing work.
2. Never resume an old branch merely because it contains an unfinished feature.
3. Reproduce bugs with a deterministic test when possible.
4. Create a fresh branch from current `main`.
5. Implement the narrowest correct fix/improvement.
6. Run Release build + full .NET tests + all extension JS syntax/tests + dashboard JS checks.
7. Verify the **exact branch head SHA**.
8. Open a PR.
9. Wait for PR/merge-state CI on that exact head.
10. If CI fails, diagnose and fix; do not weaken tests to force green.
11. Merge only when the PR is conflict-free and CI is green.
12. Verify new `main` SHA and `main` CI.
13. For user-facing/runtime changes, wait for `package-windows` on `main`.
14. Download the produced artifact and inspect the actual ZIP contents/version/runtime.
15. Only then call a build ready for the next pilot.

If `main` advances concurrently, never overwrite newer work. Rebuild/rebase the feature safely on the newer `main` and re-run validation.

## What Astra should do autonomously

The user explicitly wants the agent to do the work rather than give manual developer instructions. Use GitHub directly for inspection, commits, PRs, CI checks, merges and artifact verification whenever permissions allow.

Do not stop after saying what should be changed. Make the change.

Do not ask the user for confirmation for normal code cleanup, tests, CI fixes, safe refactors, documentation, PR creation/merge after green CI, or packaging verification.

Only stop for genuinely user-controlled/external requirements such as:

- account login
- CAPTCHA
- 2FA/SMS
- employer-side final submission where explicit candidate control is intended
- a personal fact that is not already verified
- legal/declaration questions that require the candidate's own answer

Never ask for passwords or SMS/2FA codes in chat.

## Priority after 2.4.1

### P0 — continue real pilot / bug fixing

Use actual Windows/Chrome pilot screenshots and behavior as the highest-priority evidence. For each reproducible bug: fix, test, PR, merge, package, verify.

Important next checks:

- confirm `/api/application-queue` no longer returns 500 under real local SQLite
- run one full external ATS application end-to-end
- verify CV Vault behavior on a stage that actually contains a resume input
- verify safe autofill on native fields and modern React/ARIA controls
- verify multi-step context survives navigation
- verify employer submission receipt -> explicit record -> next strong job continuation
- verify history persists after backend restart

### P1 — pilot diagnostics

Make real-PC debugging easier. Prefer a small diagnostics surface that can expose/copy:

- app/extension version
- backend readiness/storage mode
- last collection timestamp
- queue status/count
- CV Vault slot presence without exposing CV bytes
- last safe runtime error category/message

Do not expose secrets, tokens, CV contents, phone number, legal answers or sensitive field values.

### P2 — automation usability

The collector is already automatic. Improve control/visibility rather than creating a second scheduler:

- show whether background collection is active
- show last collection and next expected collection
- consider making the interval user-configurable without editing repository files
- add a clear **Collect now** action where useful
- preserve a sensible minimum interval and API-rate-limit safety

Do not enable blind external auto-submit.

### P3 — rebuild Pipeline Desk from current main

The old PR #32 is closed and must not be merged. If/when rebuilt, use the current backend pipeline/status endpoints and current extension architecture. The feature should help Violetta explicitly record recruiter progress (HR contact/interview/technical/test/offer/rejected) and feed outcome analytics. Recruiter outcomes must remain human-interpreted; do not fabricate or infer them from private messages without explicit data access and clear evidence.

### P4 — source quality / Europe coverage

Keep USA excluded. Improve Russia + Europe discovery, source reliability and eligibility filtering. Do not mistake worldwide/US-only remote listings for EU-eligible roles.

## Safety / truth boundaries

- Never fabricate work history, salary history, years of experience, legal status or skills.
- Never auto-answer criminal/background/security-clearance, medical/disability, demographic, passport/ID, DOB/age or similar sensitive questions.
- CAPTCHA/2FA stay manual.
- Do not bypass anti-bot systems.
- External employer final-submit stays user-controlled unless an explicitly supported official applicant API flow is intentionally enabled.
- HH official API submission must keep duplicate, score, blacklist, resume and authorization gates.
- Do not send recruiter outreach automatically. Follow-up drafts may be prepared/copied; the candidate controls sending.

## Tomorrow startup sequence

1. Read this file.
2. Fetch `main` and verify the latest SHA; newer `main` wins over the historical SHA above.
3. Check all open PRs; do not resurrect closed stale PR #32.
4. Check current CI / package status.
5. Continue from the latest pilot bug or P0 task without re-planning the whole system.
6. Keep working autonomously through fix -> tests -> PR -> merge -> package verification.
7. Give the user concise progress and only ask for a screenshot/login/personal fact when truly necessary.

The objective is not to keep adding features forever. The immediate objective is to make the **real Windows + Chrome pilot reliably complete actual strong applications**, then improve based on observed failures and measured outcomes.
