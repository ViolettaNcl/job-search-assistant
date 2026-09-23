# Architecture — Violetta Apply Assistant 3.7.0

## Existing-system reuse

`extension/` остаётся MV3 plain JavaScript без build step. `backend/` — существующий опубликованный Windows .NET пакет. Backend EXE/DLL не переписываются; расширение использует существующие endpoints/storage и добавляет поведение поверх них.

## Main-window Autopilot control

`home.html` / `home.js` теперь являются простым control surface для user-started agent:

```text
home popup
  → GET /api/automation/status
  → 🚀 start / ⏹ stop
  → POST /api/settings/autoapply
  → vjaAutopilotControlWake
  → background.js:runBrowserAutopilot()
```

Popup не выполняет сам application flow. Он только явно включает/выключает существующий background agent и показывает status/limits. `background.js` принимает wake только от extension-owned `home.html` или `popup.html`.

Если `vjaHhBrowserSearch` ещё отсутствует в старом профиле, 3.7 трактует browser discovery как включённый по умолчанию. Это устраняет ситуацию, когда UI показывал «искать через HH в Chrome», но background фактически не запускал discovery до первого ручного сохранения settings.

## Autopilot selection and execution

```text
User starts 🚀 Autopilot
  → HH discovery / existing queue
  → backend match score
  → junior-compatible seniority guard
  → remote guard
  → IT target guard (development / QA / technical support)
  → Candidate Truth Profile + vacancy context
  → short local cover letter
  → background application pool (max 2 automatic jobs)
  → inactive HH vacancy tab
  → existing site-apply executor
  → confirmed receipt OR review stop
  → Application Registry + Cover Letter Memory
```

Default target queries include C#/.NET, ASP.NET Core, Backend, Full-Stack .NET, QA Automation, Manual QA and Technical Support. Explicit Middle/Senior/Lead/Principal/Staff/Architect/Head/Manager titles are rejected by the local seniority guard. Backend match score remains required, so a title keyword alone is not sufficient.

## Current vacancy Apply

```text
JOB_DESCRIPTION → ✦ Apply → universal-content.js:autoApply → copilot-background.js → CV + cover letter → existing application executor → unique safe final action → CONFIRMED / REVIEW_REQUIRED / FAILED
```

The main `✦ Apply` stays on the employer flow; it does not open an internal application page.

## HH search-list quick apply

A **trusted native user click** on HH `Откликнуться` can prepare and attach a cover letter for exactly that vacancy card. It is separate from Autopilot and intentionally ignores programmatic clicks to avoid double-running an automatic application.

## Recruiter chat

`✎ AI` uses the active conversation DOM, linked Application/Vacancy when available, CV + submitted cover-letter memory, recent thread and latest recruiter message. Full-dialog analysis can load older messages and uses HH current-DOM fallback if stable message wrappers are absent. The generated text is inserted/drafted; recruiter Send remains manual.

## CV / cover letter

Vacancy language selects RU or EN bundled CV. Cover letters use only confirmed facts, prioritize technologies/requirements present in the vacancy, prefer a relevant technical project, add `https://github.com/ViolettaNcl` for IT roles and avoid irrelevant hospitality history in technical letters.

## Safety stops

Unknown/ambiguous required salary, work authorization, visa, legal/privacy declarations, contractual acceptance and similar personal decisions are not guessed. That vacancy is stopped for review while unrelated queued work can continue.

## Persistence

The existing `vjaApplicationJob:*` registry stores execution state, receipt, vacancy/CV association, timeline and Cover Letter Memory. No parallel database was introduced.
