# Testing Guide · 5.2.0

## Release layers

A release is checked through independent layers:

1. extension Node/unit regression;
2. focused Chromium HH reader/memory/questionnaire/batch/Learning Center scenarios;
3. full synthetic browser integration fixture;
4. ML/model-operations tests;
5. Python and JavaScript syntax checks;
6. workflow YAML parsing;
7. source-publication plan tests;
8. repository-hygiene tests;
9. release ZIP integrity and SHA-256 generation.

## 5.2.0 release results

- Node regression: **295 / 295 PASS**.
- Focused Chromium: **31 / 31 PASS**.
  - HH reader/API fallback: 3/3.
  - vacancy/form memory: 8/8.
  - questionnaire: 9/9.
  - Batch Analysis: 6/6.
  - Learning & Model Center: 5/5.
- Full synthetic browser integration: **102 / 102 assertions PASS**.
- Python unit tests (ML + compatibility + publication/hygiene): **20 / 20 PASS**.
- JavaScript/CJS syntax: **158 files PASS**.
- Python compile: **22 files PASS**.
- Workflow YAML: **5 / 5 PASS**.
- Backend runtime preservation: **369 checked, 0 changed** vs 5.0.0.
- Bundled CV preservation: **3 / 3 unchanged**.

## Browser-harness shutdown limitation

The full browser fixture reaches and prints `102 browser integration assertions passed.` with no uncaught DOM JS errors. In this environment the surrounding Playwright/browser process can remain alive after that marker and exceed an external tool timeout. Treat the assertion result as PASS and the process shutdown as a separate harness issue; do not claim a clean exit.

## ML rules

- Synthetic data may verify pipeline mechanics only.
- `--test-only` artifacts must remain `trainedOnRealLabels=false`.
- Model promotion must reject test-only artifacts.
- Preference and engagement datasets are separate targets.
- Calibration/tuning data must not be reused as the final held-out test set.
- Runtime quality/drift metrics require later real labels.

## Live-site validation

Synthetic fixtures cannot certify future HH changes. Before relying on a new release, run the manual checklist in `docs/PRODUCTION_CHECKLIST.md`.
