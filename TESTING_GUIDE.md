# Testing Guide · 4.0.0

## Test layers

### 1. Node unit/regression suite

```powershell
node --test browser-extension/*.test.js
```

In a FULL bundle use `extension` instead of `browser-extension`.

4.0 adds tests for:

- preference normalization;
- deterministic Fit Score;
- hard calls/sales penalties;
- skill matching;
- Ready Queue selection;
- duplicate vacancy IDs;
- page filters/progress labels;
- manifest/service-worker wiring;
- user-controlled queue behaviour.

### 2. Focused Chromium 4.0 fixture

```powershell
python tests/browser_batch_400.py
```

This fixture uses the actual extension scripts with mocked Chrome/HH boundaries. It verifies:

- one compact search-page toolbar;
- Batch Analysis of multiple cards;
- Fit badges;
- calls penalty;
- Ready Queue selection;
- no-calls filter;
- vacancy-ID Fit memory restoration.

It does **not** log into a live HH account.

### 3. Existing HH reader regression

```powershell
python tests/hh_read_fallback_3910.py
```

Checks interactive-but-loading hidden tabs and exact `api.hh.ru` fallback.

### 4. Vacancy/form memory

```powershell
python tests/browser_memory_399.py
```

Checks Analysis restoration, quick-list continuation and return-to-list form memory.

### 5. Smart Questionnaire regression

```powershell
python tests/browser_questionnaire_3912.py
```

Checks projects/English answers, salary fallback, dynamic fields and manual final submit.

### 6. Source publication

```powershell
python tests/test_source_publication.py
```

Verifies the release manifest/publisher contract.

### 7. Repository hygiene

```powershell
python tests/test_repository_hygiene.py
python tools/check-repo-hygiene.py
```

Prevents FULL/runtime/build/test-output pollution in Git source.

## JavaScript syntax

```powershell
Get-ChildItem browser-extension -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Python compile

```powershell
python -m py_compile tests/*.py tools/*.py
```

## Workflow YAML

Parse/check all `.github/workflows/*.yml` files before release.

## Real-site validation

Synthetic PASS and live-HH validation must be reported separately. A fixture verifies our logic against a controlled DOM/API boundary; it does not certify future HH production markup, CAPTCHA/MFA behaviour or rate limits.

Before publishing a major milestone such as 4.0, test at least:

1. a no-calls support vacancy;
2. a confirmed calls vacancy;
3. a repeated vacancy card;
4. Batch Analysis on a normal result page;
5. Ready Queue → explicit Apply;
6. a questionnaire redirect and return to the list.
