# Testing guide — 3.7.0

## Source layout

Chrome extension source:

```text
browser-extension/
```

Backend source:

```text
src/JobSearchAssistant/
```

## Extension tests

Node 22+:

```powershell
$tests = Get-ChildItem .\browser-extension\*.test.js | Select-Object -ExpandProperty FullName
foreach ($test in $tests) {
  node $test
  if ($LASTEXITCODE -ne 0) { throw "Failed: $test" }
}
```

## Backend tests

```powershell
dotnet restore .\src\JobSearchAssistant\JobSearchAssistant.csproj
dotnet build .\src\JobSearchAssistant\JobSearchAssistant.csproj -c Release --no-restore
dotnet test .\tests\JobSearchAssistant.Tests\JobSearchAssistant.Tests.csproj -c Release
```

## Synthetic browser regression

```powershell
python -m pip install playwright
python -m playwright install chromium
python .\tests\browser_e2e.py
```

These fixtures use synthetic/mock employer pages. They do not log in to a real HH.ru account and do not submit real applications.

## Manual acceptance checklist

1. **Version** — `browser-extension/manifest.json` and backend project version are `3.7.0`.
2. **Backend** — `http://127.0.0.1:8080` becomes ready.
3. **Profile/CV** — RU/EN CV assets and contact profile are available.
4. **✦ Apply** — current-vacancy flow stays on the employer site.
5. **HH list quick apply** — user click on `Откликнуться` prepares the letter for the same vacancy card.
6. **High-risk stop** — salary/visa/legal/privacy ambiguity stops the application.
7. **✎ AI** — active recruiter chat produces a draft for the current conversation.
8. **Full-dialog analysis** — accessible history is read and latest recruiter message is addressed.
9. **Chat isolation** — a late Chat A response must not appear after switching to Chat B.
10. **Quick Replies** — only the compact Russian library is shown.
11. **🚀 Autopilot** — explicit start/stop works and status/limits are visible.
12. **Autopilot filters** — explicit Middle/Senior/Lead/Manager roles are skipped.
13. **Session/day limits** — respected.
14. **Duplicate protection** — repeated application does not silently double-submit.
15. **Live-site smoke test** — run a small manual test after major HH/ATS DOM changes.

## GitHub Actions

- `.github/workflows/ci.yml` — backend + extension validation
- `.github/workflows/site-apply-regression.yml` — application/extension regression
- `.github/workflows/package-windows.yml` — builds the Windows release artifact
- `.github/workflows/codeql.yml` — CodeQL

## Generated artifacts

Do not commit:

- `backend/` self-contained runtime;
- `test-results/`;
- ZIP release bundles;
- generated hashes/logs;
- build `bin/` / `obj/`.

These are excluded by `.gitignore` and/or produced by CI.

## What automated tests do not prove

- every live HH/LinkedIn/Indeed/Workday DOM variant;
- CAPTCHA/MFA handling;
- every custom ATS widget;
- external provider uptime;
- permanent compatibility after employer-site UI changes.
