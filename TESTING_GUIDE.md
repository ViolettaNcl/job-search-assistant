# Testing Guide · 5.0.0 Foundation

## JavaScript regression

```powershell
node --test browser-extension/*.test.js
```

FULL bundle: use `extension/*.test.js`.

Current 5.0.0 release run: **275 / 275 PASS**.

## ML pipeline

```powershell
python tests/test_ml_foundation.py
```

The ML test uses synthetic fixtures only to exercise training/evaluation/registry/promotion code. Test models are explicitly marked non-real and promotion is required to reject them. Synthetic fixture metrics are not product-quality claims.

## Browser fixtures

Focused suites:

```powershell
python tests/browser_batch_400.py
python tests/browser_memory_399.py
python tests/browser_questionnaire_3912.py
python tests/hh_read_fallback_3910.py
```

Full legacy integration fixture:

```powershell
python tests/browser_e2e.py
```

The 5.0.0 release reached **102 / 102 PASS assertions** in the full fixture. The fixture prints its successful completion before the surrounding local browser process sometimes remains alive long enough for an external harness timeout; this is recorded as a harness-shutdown limitation, not hidden as a clean process exit.

## Publication / hygiene

```powershell
python tests/test_source_publication.py
python tests/test_repository_hygiene.py
python tools/check-repo-hygiene.py
```

## Syntax / compile

```powershell
Get-ChildItem browser-extension -Filter *.js | ForEach-Object { node --check $_.FullName }
python -m py_compile tests/*.py tools/*.py tools/ml/*.py
```

## Real-site validation

Synthetic fixtures are not equivalent to future HH production DOM verification. 4.0 Batch Analysis was manually confirmed in a real HH session before this 5.0 foundation work. New 5.0 Learning Center / feedback / interview-prep / offline ML-tooling surfaces still need normal user verification after installing the release.
