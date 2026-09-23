# Violetta Apply Assistant 3.7.0

## 🚀 Main-window Autopilot

A dedicated **🚀 Запустить автопилот** control is available in the compact extension popup.

The user explicitly starts/stops the agent. The popup shows current status plus match/session/day limits.

Autopilot reuses the existing background automation pipeline and focuses by default on suitable remote IT roles, including C#/.NET, ASP.NET Core, Backend, Full-Stack .NET, QA / QA Automation and Technical Support.

Explicit Middle/Senior/Lead/Principal/Staff/Architect/Head/Manager roles are filtered out by the junior-compatible guard.

## ✦ Apply

The main floating **✦ Apply** action starts the current-vacancy application workflow without redirecting to an internal extension page.

The flow selects the RU/EN CV, builds a vacancy-specific short letter, handles supported form/application steps and records the result.

## HH search-list quick apply

After a real user click on HH.ru **Откликнуться**, the extension can attach a vacancy-specific cover letter for that exact vacancy card when the HH flow is unambiguous.

## ✎ AI recruiter chat

**✎ AI → 🧠 Проанализировать весь диалог и ответить** reads the accessible current conversation and prepares a reply draft for the latest recruiter message.

The reply is reviewed by the user before Send.

## Cover letters

Technical letters are shorter and vacancy-first:

- prioritize confirmed relevant skills/projects;
- avoid repeating the whole CV;
- avoid unrelated hospitality experience for developer/QA roles;
- include `https://github.com/ViolettaNcl` for relevant IT vacancies.

## CV

The simplified resolver uses Russian or English bundled CV according to vacancy language/context.

## Persistence

Application Registry, Cover Letter Memory, timeline, follow-up and analytics remain available.

## Backend startup

The local extension/backend endpoint is standardized on:

```text
http://127.0.0.1:8080
```

Launcher/diagnostic scripts are included for the Windows bundle.

## Repository cleanup

The Git repository now keeps source and documentation only:

- `browser-extension/`
- `src/`
- `tests/`
- `scripts/`
- `tools/`
- `docs/`

Generated Windows runtime binaries, ZIP releases, `test-results/` and hash dumps are excluded from source control.

## Limitations

Live employer sites can change DOM/flow without notice. Synthetic regression tests do not replace live smoke testing.

CAPTCHA/MFA and ambiguous legal/personal decisions are not bypassed or guessed.
