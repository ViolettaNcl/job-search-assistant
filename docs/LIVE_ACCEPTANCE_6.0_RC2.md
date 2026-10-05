# Live Acceptance · 6.0.0 RC2

This checklist is intentionally separate from automated fixtures. A live provider flow is accepted only after it is exercised in the user's authenticated browser session.

## HH / HeadHunter

1. Open a search results page and confirm card controls render once per vacancy.
2. Run **Analyze page** and verify Fit and Calls remain separate signals.
3. Open a vacancy with a direct HH application and verify the vacancy-specific cover letter remains bound to the exact vacancy ID.
4. Open a vacancy that redirects to a dedicated questionnaire page.
5. Confirm **✦ Fill** appears next to the native response action.
6. Press **Fill** and verify every supported free-text field receives either a confirmed answer or a clearly reviewable draft.
7. Confirm legal/consent fields are not silently accepted and the native final **Откликнуться / Submit** action is not clicked by Fill.
8. Navigate back/reload and verify vacancy/application/questionnaire memory survives.
9. Open Product Center and verify applications, learning state, model state and diagnostics load.
10. Create a password-protected backup, preview it, and restore only after confirming the preview.

## Habr Career beta

1. Open a current `career.habr.com/vacancies/...` vacancy.
2. Confirm the adapter detects a job description and reads title/company/description.
3. Confirm assistant controls render without breaking the page.
4. If an authenticated application form is available, verify Fill only after manually reviewing the detected fields.

Habr Career remains **beta** until its authenticated application/questionnaire flow is live-validated. Public-page fixture coverage is not equivalent to a completed live apply test.

## Acceptance result

Record date, provider, browser version, tested vacancy IDs (without copying private conversation data), result, and any selector/UI issue. Promote RC2 to final only after the HH checklist passes in the real account.
