# Architecture — Violetta Apply Assistant 3.7.0

## Source-of-truth layout

The maintained source tree is:

```text
browser-extension/            Manifest V3 Chrome extension
src/JobSearchAssistant/       .NET 10 backend source
tests/                        backend and browser/integration tests
scripts/                      source/release verification scripts
tools/                        maintenance/update helpers
docs/                         requirements/history
.github/workflows/             CI and Windows packaging
```

The repository does **not** store the generated self-contained Windows backend, ZIP releases or generated test-result folders. Those are build/release artifacts.

## Chrome extension

`browser-extension/` is the current extension source. It remains plain Manifest V3 JavaScript with no mandatory frontend build step.

Main surfaces:

- `home.html` / `home.js` — compact user control surface
- `background.js` — service worker and orchestration
- `site-apply*.js` — application execution
- `hh-list-quick-apply*.js` — HH search-list quick cover-letter flow
- `recruiter-chat*.js` — current recruiter-chat reading and AI draft UI
- `copilot-*.js` — context, profile and AI helper logic
- `site-adapters.js` — provider-specific/generic detection
- `application-state-machine.js` — application workflow state
- `application-analytics.js` / follow-up modules — local tracking and follow-up logic

## Local backend

Source: `src/JobSearchAssistant/`

Runtime endpoint:

```text
http://127.0.0.1:8080
```

The backend owns the existing vacancy/application pipeline, match scoring, HH integration, queueing, tracking and local persistence.

The installed Windows bundle uses a persistent SQLite database outside the release folder so upgrades do not require deleting user data.

## Autopilot control

```text
home popup
  → read automation status
  → 🚀 start / ⏹ stop
  → update auto-apply settings
  → wake background worker
  → background discovery / queue
  → match + seniority + role guards
  → application executor
```

Autopilot is user-started. The popup is a control surface; it does not create a second automation engine.

Default target families are remote IT roles such as C#/.NET, ASP.NET Core, Backend, Full-Stack .NET, QA / QA Automation and Technical Support.

## Current-vacancy Apply

```text
JOB_DESCRIPTION
→ ✦ Apply
→ vacancy context
→ RU/EN CV resolver
→ cover-letter engine
→ supported form/application executor
→ CONFIRMED / REVIEW_REQUIRED / FAILED
```

The user stays in the employer flow. Internal extension pages are not part of the normal Apply path.

## HH search-list quick apply

A trusted native user click on HH.ru **Откликнуться** can pin the exact vacancy card, prepare the cover letter and continue through the supported HH cover-letter modal.

Programmatic/autopilot clicks do not reuse that trusted-click shortcut, preventing duplicate execution.

## Recruiter chat

`✎ AI` operates on the currently active conversation.

Context can include:

```text
active chat DOM
+ latest recruiter message
+ linked Application/Vacancy when available
+ CV used
+ submitted Cover Letter Memory
+ recent thread memory
```

Full-dialog analysis uses DOM-first extraction with HH-specific fallbacks. Stale responses are discarded when the user actually changes conversations.

The assistant prepares/inserts a draft. Recruiter Send is manual.

## CV and cover-letter memory

The extension contains Russian and English CV assets. Vacancy language selects the base CV.

Each application can retain the exact generated/submitted cover letter and associated vacancy/CV metadata so later recruiter-chat drafts can refer to what was actually sent.

## Safety gates

The application workflow must stop rather than guess on ambiguous required decisions such as:

- salary expectations;
- visa/work authorization;
- legal/privacy declarations;
- contractual commitments;
- other unknown mandatory candidate facts.

CAPTCHA/MFA and browser security restrictions are not bypassed.

## Packaging

`.github/workflows/package-windows.yml` publishes the .NET backend and combines it with `browser-extension/` and Windows launcher files.

Generated runtime binaries are release artifacts, not Git source files.
