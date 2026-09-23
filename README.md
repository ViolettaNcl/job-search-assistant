# Violetta Apply Assistant

**Current version: 3.7.0**

Personal Windows + Chrome job-application assistant for Violetta Nicolaou. The project combines a local .NET backend, a Manifest V3 Chrome extension, vacancy matching, vacancy-specific cover letters, recruiter-chat assistance, application tracking and a user-started HH.ru autopilot.

> The repository contains source code and documentation. Generated Windows runtime binaries, ZIP release bundles and test-output folders are intentionally excluded from Git.

## Core workflows

### 🚀 Autopilot

The compact extension popup contains a dedicated **🚀 Запустить автопилот** control.

After the user starts it, the agent can:

- discover vacancies through the existing HH.ru browser workflow;
- evaluate match score and seniority;
- prioritize remote IT roles;
- skip clearly unsuitable Middle / Senior / Lead / Principal / Staff / Architect / Head / Manager roles;
- prepare a short vacancy-specific cover letter;
- open suitable vacancies in background tabs;
- execute supported application flows;
- keep session and daily limits.

Default target areas include C#/.NET, ASP.NET Core, Backend, Full-Stack .NET, QA / QA Automation and Technical Support.

Autopilot is never started silently. The user starts and stops it from the extension UI.

### ✦ Apply

On an opened vacancy, **✦ Apply** launches the application workflow for that vacancy:

```text
vacancy analysis
→ language / CV selection
→ vacancy-specific cover letter
→ supported form handling
→ application execution
→ confirmed / review required / failed
```

The workflow stays on the employer site instead of redirecting to an internal extension page.

### HH.ru quick apply from search results

When the user presses HH.ru's native **Откликнуться** button on a vacancy card, the extension can prepare and attach a cover letter for that exact vacancy without requiring the detail page to be opened manually.

If HH.ru opens an ambiguous or unsupported flow, the shortcut stops instead of guessing a different action.

### ✎ AI recruiter chat

Inside the currently opened recruiter conversation:

**✎ AI → 🧠 Проанализировать весь диалог и ответить**

The assistant reads the accessible active conversation, considers the latest recruiter message, linked vacancy/application context when available, the CV used and Cover Letter Memory, then prepares a reply draft.

Recruiter **Send remains manual**.

Additional chat actions include:

- answer the latest message;
- improve the user's draft;
- answer all visible questions;
- suggest a relevant question to the recruiter;
- concise quick replies.

### CV and cover letters

The extension ships with Russian and English CV versions and selects the language version from vacancy context.

Technical cover letters are intentionally short and vacancy-first. They prioritize relevant confirmed skills/projects and may include:

`https://github.com/ViolettaNcl`

For developer / QA / technical roles, unrelated hospitality experience is not used as the main selling point.

## Repository structure

```text
browser-extension/            Chrome Extension source (current 3.7.0)
src/JobSearchAssistant/       .NET backend source
tests/                        .NET + browser/integration tests
scripts/                      source/release verification helpers
tools/                        maintenance/update tools
docs/                         project requirements/history
.github/workflows/             CI, CodeQL and Windows packaging

README.md
ARCHITECTURE.md
IMPLEMENTATION_STATUS.md
SUPPORTED_SITES.md
TESTING_GUIDE.md
WHAT_CHANGED.md
START_HERE.txt
```

The generated self-contained Windows backend is built by GitHub Actions and is **not** stored in the source tree.

## Local backend

The extension communicates with the local backend at:

```text
http://127.0.0.1:8080
```

For an installed Windows bundle use:

```text
start-assistant.cmd
```

If readiness fails, use:

```text
BACKEND_DIAGNOSTICS.cmd
```

The default local SQLite database is stored outside the bundle under `%LOCALAPPDATA%\ViolettaApplyAssistant`.

## Source build

The backend source lives in `src/JobSearchAssistant/` and targets .NET 10.

The packaged Windows release is assembled by `.github/workflows/package-windows.yml` from:

- `src/JobSearchAssistant/`
- `browser-extension/`
- `scripts/`

Use `START_FROM_SOURCE.cmd` when working from the source repository.

## Safety and truthfulness

The assistant must not invent candidate experience, years of experience, employers, qualifications or legal status.

Unknown or ambiguous required fields such as salary expectations, visa/work authorization, legal/privacy declarations and contractual commitments are review stops rather than guessed answers.

CAPTCHA/MFA bypass is not implemented.

## Testing

Automated checks cover extension logic, backend services and synthetic browser fixtures. They do **not** log in to real employer accounts or guarantee compatibility with every future DOM variant.

See:

- `TESTING_GUIDE.md`
- `SUPPORTED_SITES.md`
- `IMPLEMENTATION_STATUS.md`

## Documentation

- `ARCHITECTURE.md` — architecture and data flow
- `IMPLEMENTATION_STATUS.md` — implemented / partial / pending areas
- `SUPPORTED_SITES.md` — platform support and limitations
- `TESTING_GUIDE.md` — local and CI verification
- `WHAT_CHANGED.md` — 3.7.0 changes
- `START_HERE.txt` — practical Windows usage/update notes
