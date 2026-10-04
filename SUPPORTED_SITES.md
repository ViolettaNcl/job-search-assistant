# Supported Sites · 5.2.0

## HeadHunter family — primary validated provider

Declared core hosts:

- `hh.ru`
- `*.hh.ru`
- `headhunter.kg`
- `*.headhunter.kg`
- `api.hh.ru` for exact-vacancy fallback reads

### Current HH surfaces

| Surface | Support |
|---|---|
| Search/list | Analysis, Batch Analysis, Fit + Calls, filters, Ready Queue, feedback |
| Direct vacancy | Exact vacancy context and apply helpers |
| Application questionnaire | Autofill, memory, correction capture, review gate, pre-submit diff |
| Recruiter chat | Contextual draft assistant / intent intelligence |
| Interview workflow | Vacancy-grounded prep and local mock-answer structure review |
| Local dashboard | Optional advanced backend mode |

## Multi-site architecture

`site-adapter-core.js` defines a provider contract for future adapters. Some legacy generic selectors may work on other sites, but 5.2 does **not** label another provider fully supported until its current live search/apply/questionnaire/chat flows are validated and regression-covered.

## External employer forms

Support is conservative and depends on granted Chrome host access plus accessible semantic controls. CAPTCHA, MFA, inaccessible cross-origin iframes and custom canvas/shadow controls may require manual action.

## Permission model

Chrome site access can be configured by the user. The extension cannot bypass `On click` or denied host access. Grant persistent site access only to providers/forms you want the assistant to inspect.
