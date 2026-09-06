# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

Version **1.3** is a review-first application autopilot for Russia and Europe. It combines the ranked daily application queue, temporary deferrals, truthful vacancy-specific drafts, verified safe autofill, CV selection, multi-step ATS context, safe opener-linked tab handoff and a submission checklist that now detects visible required fields that are still blank.

## Daily apply loop

The popup shows the strongest **75+** unapplied job from the backend queue.

Typical workflow:

1. Click **Open next strong job**.
2. Analyze the vacancy.
3. Review the fit, tailored draft and recommended CV.
4. Fill only fields the assistant classifies as safe.
5. Resolve review/manual/required checkpoints yourself.
6. Verify the CV attachment.
7. Press the employer's final Submit/Apply button yourself.
8. Click **Mark applied** for external applications.
9. The popup advances to the next ranked strong job.

The browser does not create its own competing ranking model. It uses `GET /api/application-queue?limit=20&minScore=75` and excludes only invalid URLs, likely-ineligible jobs, sub-75 jobs and the vacancy already active in the current workflow.

## Temporary queue deferral

**Defer 4h** temporarily moves a strong vacancy out of the queue without pretending it was applied, rejected or permanently skipped.

The backend records `QueueDeferredUntil=<UTC timestamp>` in the existing application-event history. While the timestamp is active, the job stays out of the queue. After expiry it can reappear automatically. Ordinary manually saved/bookmarked vacancies remain excluded.

## ATS context and tab handoff

Application context is kept in ephemeral `chrome.storage.session` and expires after eight hours. It includes vacancy metadata, fit result, current cover-letter edit, recommended CV label and tracker ID when available. It does not contain CV bytes, passwords, CAPTCHA/2FA answers, legal declarations or sensitive profile answers.

Same-tab ATS continuation restores the session only on a compatible application route. Version 1.2 also added conservative cross-tab/new-window handoff using Chrome's real `openerTabId`.

Cross-tab handoff requires:

- the child tab's opener to be exactly the session-owning tab;
- an application-looking destination route;
- a matching deterministic employer/tenant identity;
- an unexpired session.

When valid, the session is **moved**, not copied, to avoid a stale duplicate in the opener tab.

Employer identity is derived conservatively for Workday, Teamtailor, Recruitee and Personio subdomains plus shared-host URL structures for SmartRecruiters, Lever, Ashby, Greenhouse and Workable. A different employer on the same shared ATS host cannot claim the application context.

## Required-field completeness — v1.3

Version 1.3 closes a submission-readiness gap: a form must not appear clear merely because the resolver did not understand a visible required control.

The content-side completeness layer enriches each scanned field with required-state metadata. It recognizes:

- native HTML `required` controls;
- `aria-required="true"` controls;
- native required radio groups, counted once rather than once per option;
- required checkboxes and file inputs;
- ARIA radiogroups/custom controls when their required state is exposed;
- conservative visible label markers such as `required`, `обязательное`, `υποχρεωτικό`, `obligatoire`, or a standalone `*` marker.

A blank required control becomes a distinct **Required** checkpoint in the submission checklist.

Required checkpoints are deduplicated against existing safety states. For example, if a required work-authorization question is already classified as **Review**, or a required email field has a verified autofill failure, the checklist does not display a second duplicate Required warning.

Once the required control has a detectable answer, it disappears from the required count on the next scan/recheck.

The completeness pass deliberately does **not** treat every blank field as required. Optional fields remain optional.

## Submission-readiness states

The checklist distinguishes:

- **Checklist clear** — no unresolved, failed-fill or detectably blank required controls were found;
- **Review needed** — employer-specific questions, failed safe fills or blank required controls still need attention;
- **Manual action** — blocked legal, security, CAPTCHA, medical, demographic or other protected questions require candidate action.

The visible **Needs review** count includes required blanks and failed fills so the compact summary cannot disagree with the detailed checklist.

After safe autofill or a manual recheck, the extension rescans the form and recalculates required-state information. A previous Required checkpoint therefore clears only after the current form state actually contains an answer.

A clear checklist is still not proof that the employer site is complete. It covers only controls the extension can detect. Always inspect the full page, attachments and employer validation messages before final submission.

## ATS extraction and custom controls

The extension prefers Schema.org `JobPosting` JSON-LD before fragile visual selectors. It extracts title, company, description, location/country, remote status and experience hints when available, with ATS-specific and generic DOM fallbacks.

Host recognition includes HH.ru, Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Teamtailor, Recruitee, Workable and Personio.

ARIA comboboxes, listbox-opening buttons and radiogroups are detected so modern ATS questions are visible to the checklist. Ambiguous custom controls remain review-first; the extension does not guess selections.

Legal, verification/CAPTCHA, security, identity-document, demographic and medical questions stay blocked from automatic answering.

## Verified safe autofill

For fields classified as safe, the extension:

1. writes the intended truthful value;
2. dispatches normal input/change/blur events;
3. waits for the ATS UI to settle;
4. reads the field back;
5. deterministically compares the persisted value with the intended value.

If the value did not persist, the field becomes **Autofill failed / Verify fill** rather than silent success.

## Application Memory

**Remember confirmed answers** stores reusable answers only after Violetta enters/confirms them and explicitly asks the extension to remember them.

It deliberately does not automatically learn or reuse salary expectations, exact availability dates, relocation commitments, commercial-experience years, criminal/legal declarations, passport/national-ID data, date of birth/age, medical/disability information, demographic answers or security-clearance declarations.

## CV Vault

The local CV Vault stores English and Russian PDFs in `chrome.storage.local`; PDF bytes are not uploaded to the backend.

**Upload recommended CV** inserts the selected local file only after explicit user action. Always verify the employer page shows the expected filename.

## HH.ru direct submission

For an HH vacancy scoring **75/100 or higher**, the extension can use HH's official applicant API after explicit confirmation. HH OAuth and an HH resume must be configured first.

The extension does not bypass CAPTCHA/2FA or imitate hidden browser clicks.

## Install locally

1. Run the backend at `http://localhost:8080`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `browser-extension` folder.
6. Pin **Violetta Apply Assistant**.
7. Open **CV Vault setup** and store the English/Russian PDFs.
8. After extension updates, click **Reload** on the extension card.

## Main backend APIs used

- `GET /health`
- `GET /api/candidate`
- `GET /api/application-queue?limit=20&minScore=75`
- `POST /api/extension/analyze`
- `POST /api/extension/resolve-fields`
- `POST /api/import/hh`
- `POST /api/import/browser`
- `POST /api/vacancies/{id}/status`
- `POST /api/vacancies/{id}/apply-tailored`
- `POST /api/vacancies/{id}/mark-applied`
- `GET /api/vacancies/{id}/application-draft`

## Privacy and safety model

Vacancy/form information is sent to the configured backend only after the user requests analysis or a form action. The extension does not background-scan unrelated browser tabs.

Reusable answers and CV files stay in the local Chrome profile. Multi-step context is ephemeral. Cross-tab handoff follows only the browser-provided opener relation plus deterministic ATS employer identity. Required-field detection inspects visible form metadata and current values locally; it does not invent answers or weaken protected-field rules.

## Validation

The release test suite covers backend tests plus deterministic extension tests for structured ATS extraction, custom controls, safe-fill persistence, corrected-fill reconciliation, required-field semantics, browser-scope required enrichment, submission readiness, multi-step/opener-linked ATS sessions, daily queue selection and queue deferrals.

## Next iteration

- validate v1.3 on real Workday, SmartRecruiters, Greenhouse, Lever, Ashby, Teamtailor, Recruitee, Workable and Personio application forms;
- add platform-specific adapters only where field/value behavior is deterministic and safe;
- improve detection of employer-side validation messages without pretending those messages are always visible before submit;
- use outcome analytics to decide which role families, sources and CV variants deserve more applications.
