# Testing Guide · 6.0.0 RC2

## Automated suites

- `node --test extension/*.test.js`
- `python -m unittest discover -s tests -p 'test_*.py'`
- `python tests/browser_e2e.py`
- focused Chromium fixtures: HH reader, memory, questionnaire, batch, learning, Product Center, RC2 standalone questionnaire and Habr beta.
- JavaScript syntax (`node --check`), Python compile and workflow-YAML parse checks.

## Live acceptance

Automated fixtures mock Chrome/HTTP/authentication boundaries. Before calling RC2 final, follow `docs/LIVE_ACCEPTANCE_6.0_RC2.md` in the user's authenticated HH browser, especially the dedicated questionnaire redirect shown during real testing.

## Safety expectations

- Fill may write confirmed answers or clearly reviewable drafts.
- Fill must not click the employer's final submit action.
- Legal/work-authorization/consent facts remain review-gated.
- Real-label ML training must refuse insufficient/one-class data and must not auto-promote the trained candidate.
