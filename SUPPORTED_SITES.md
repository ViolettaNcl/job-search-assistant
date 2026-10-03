# Supported Sites · 5.0.0 Foundation

## HeadHunter family

### Supported core hosts

- `hh.ru`
- `*.hh.ru`
- `headhunter.kg`
- `*.headhunter.kg`

### Supported page classes

| Page | Support |
|---|---|
| Vacancy search/list | Per-card Analysis, `✦ Отклик + письмо`, Batch Analysis, Fit Score, filters and Ready Queue |
| Direct vacancy | Exact vacancy context extraction and application helpers |
| HH application questionnaire | Smart Questionnaire Autofill + persistent answer memory |
| Recruiter chat | `✎ AI` draft assistant |
| Local dashboard | Advanced backend mode |

## Search-list intelligence

The 5.0 toolbar is enabled on supported HH search/list pages. It can analyze the visible unique vacancies with bounded concurrency, restore cached results by exact vacancy ID, calculate an explainable deterministic Fit Score, and build a user-controlled Ready Queue.

The score is **not a trained ML model** in 4.0. It uses `rules-v1` so every result can be explained and so the project can begin collecting clean structured signals for the 4.1 learning phase.

Batch Analysis never means mass submission. Apply remains a separate user action.

## HH API

Extension host permission includes:

```text
https://api.hh.ru/*
```

The API is used as a fallback for exact-vacancy reading when background DOM access is not reliable.

## Generic / external employer forms

Support is conservative. The questionnaire engine can understand standard text fields, textarea, radio/select/checkbox controls when the extension has access to the page and the question context is readable.

Not guaranteed:

- arbitrary third-party ATS portals;
- CAPTCHA-protected forms;
- MFA flows;
- inaccessible cross-origin iframes;
- custom canvas/shadow controls without usable semantics.

## Permission model

Chrome can keep site access in `On click` mode if the user configured it manually. The extension cannot bypass that setting. Grant persistent site access to supported HH hosts if automatic reinjection is required.
