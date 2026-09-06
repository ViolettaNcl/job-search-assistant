# Local Contact Profile — v2.3

Violetta Apply Assistant can keep a phone number and LinkedIn profile as reusable contact facts in the current Chrome profile so common application fields do not need to be typed repeatedly.

## Storage model

The feature deliberately reuses the existing `applicationMemory` object in `chrome.storage.local`:

- `applicationMemory.phone`
- `applicationMemory.linkedin`

It does not introduce another contact database or commit personal contact values into this repository.

Other remembered application answers are preserved when phone or LinkedIn are saved, changed, or cleared.

## Precedence

The backend candidate profile remains authoritative when it already contains a verified contact value.

For each contact field the resolver uses this order:

1. verified candidate-profile value from the backend;
2. user-saved local browser value;
3. manual review when neither exists.

This means a future verified backend phone or LinkedIn value automatically takes precedence without requiring the local browser value to be deleted first.

## Validation

Before saving locally:

- phone values accept digits plus normal phone punctuation and must contain 7–15 digits;
- LinkedIn values are normalized to HTTPS and must point to a `linkedin.com` host with a non-root profile path.

The extension never invents a missing contact value.

## Privacy boundary

Local contact values are persisted in `chrome.storage.local` and are not committed to GitHub.

When an employer form is prepared, the existing field-resolution request sends reusable `applicationMemory` values to the Job Search Assistant backend configured in the extension. This is necessary for the backend resolver to decide whether a visible phone/LinkedIn field can be safely filled. The values are not added to source control by this feature.

CV Vault PDFs remain separate: they stay in Chrome local extension storage and are not sent to the backend by the setup/readiness flow.

Salary expectations, legal declarations, identity documents, health/demographic answers, CAPTCHA/2FA values and other sensitive/job-specific fields are not turned into local contact facts.

## User controls

Setup & Readiness provides:

- **Save local contacts** — validates and writes phone/LinkedIn into the existing application memory;
- **Clear local contacts** — removes only phone/LinkedIn while preserving unrelated remembered answers;
- readiness status showing whether both reusable contact fields are available from either the backend profile or local browser profile.

The extension popup has a direct **Setup & Readiness** button and reports contact readiness without displaying the actual phone number or LinkedIn URL.

## Tests

`candidate-local-profile.test.js` covers:

- phone validation;
- LinkedIn normalization and host validation;
- preservation of unrelated memory keys;
- contact-only clearing;
- backend-over-local precedence;
- partial and complete readiness states.

`setup-readiness.test.js` verifies that missing optional contact details request attention but never block the core external ATS workflow.
