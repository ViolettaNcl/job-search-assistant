# Testing Guide · 3.9.13

## Goals

Tests protect four areas:

1. extension logic;
2. browser/HH integration fixtures;
3. source publication and repository hygiene;
4. backend build/tests.

## Extension unit/regression tests

From the release/source root:

```powershell
node --test browser-extension/*.test.js
```

In FULL bundle the extension source is under `extension/`:

```powershell
node --test extension/*.test.js
```

## JavaScript syntax

```powershell
Get-ChildItem .\extension -Filter *.js | ForEach-Object {
  node --check $_.FullName
}
```

## Focused browser fixtures

The release contains focused Python/Chromium fixtures for:

- quick-list apply;
- persistent vacancy/form memory;
- full vacancy hidden-tab/API fallback;
- questionnaire autofill and human fallback drafts.

Examples:

```powershell
python tests\browser_memory_399.py
python tests\hh_read_fallback_3910.py
python tests\browser_questionnaire_3912.py
```

These fixtures use synthetic/mocked HH boundaries and do not certify future production DOM changes.

## Source publication tests

```powershell
python tests\test_source_publication.py
```

Checks include:

- version/repository identity;
- SHA-256 integrity;
- allowed source targets;
- forbidden binaries/secrets;
- duplicate targets;
- no force/reset/clean publication behavior;
- normal Git push semantics.

## Repository hygiene

```powershell
python tools\check-repo-hygiene.py
python tests\test_repository_hygiene.py
```

The hygiene check fails when tracked Git paths contain:

- nested `Violetta-Apply-Assistant-*` release folders;
- root `backend/`, `extension/`, `github-source/`, `test-results/`;
- build/runtime artifacts;
- local databases/logs/secrets.

## Backend

```powershell
dotnet restore src\JobSearchAssistant\JobSearchAssistant.csproj
dotnet build src\JobSearchAssistant\JobSearchAssistant.csproj -c Release --no-restore
dotnet test tests\JobSearchAssistant.Tests\JobSearchAssistant.Tests.csproj -c Release
```

## CI

`.github/workflows/ci.yml` runs backend build/tests, extension syntax/tests, release metadata verification and repository hygiene on push/PR.

Additional workflows cover CodeQL, candidate-memory regression, site-apply regression and Windows packaging.

## Release verification

Before publishing a release:

1. run extension tests;
2. run focused browser regressions;
3. run source-publication tests;
4. run hygiene check;
5. verify manifest/backend release versions;
6. verify ZIP hashes.

Exact release counts belong in `TEST_REPORT.md`, not in README, so the project description does not become stale after every new test.
