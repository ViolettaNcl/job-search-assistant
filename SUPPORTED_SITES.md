# Supported Sites · 3.9.13

## HeadHunter family

### Supported core hosts

- `hh.ru`
- `*.hh.ru`
- `headhunter.kg`
- `*.headhunter.kg`

### Supported page classes

| Page | Support |
|---|---|
| Vacancy search/list | Analysis + quick apply card actions |
| Direct vacancy | Core apply / context extraction |
| HH application questionnaire | Smart Questionnaire Autofill |
| Recruiter chat | `✎ AI` draft assistant |
| Local dashboard | Advanced backend mode |

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
