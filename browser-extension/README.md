# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

Version **0.9** is a review-first application autopilot for Russia and Europe. It analyzes vacancies only after the user asks, creates truthful role-specific application material, reuses explicitly confirmed answers, verifies safe ATS autofill, automatically refreshes the submission checklist, keeps the application context across compatible multi-step ATS pages, stores applications in the CRM, and can insert the recommended CV from a local browser vault.

## External job sites

1. Open a vacancy in Chrome.
2. Click **Violetta Apply Assistant**.
3. Click **Analyze this vacancy**.
4. The backend scores the job and creates a truthful role-specific application draft.
5. The extension scans the application form and reports safe, review and blocked fields.
6. Click **Fill safe fields**. The extension waits for the ATS UI to settle, verifies each attempted fill, and automatically refreshes the checklist.
7. If the ATS moves to another compatible application step in the same browser tab, reopen the extension: the vacancy, fit score, edited cover letter, CV recommendation and tracker context are restored automatically.
8. Correct any review/manual-only/failed-fill items yourself. **Recheck submission checklist** remains available after manual edits.
9. Click **Upload recommended CV** when a stored CV is available and verify the employer page shows the expected attachment.
10. Review the whole employer form, then press the website's final Submit/Apply button yourself.
11. Click **Mark applied** after submission so the application is recorded in the CRM.

**Save to tracker** can store the vacancy before you apply. Rich browser import keeps the job description, country/location, fit score and eligibility instead of saving only a shallow link. Duplicate source URLs reuse the existing CRM record.

## Multi-step ATS sessions

Version 0.9 keeps the active application context in `chrome.storage.session`, keyed to the current browser tab. This solves a common problem on Workday/SmartRecruiters/Personio-style flows where the job description disappears after the candidate moves from the vacancy page into step 2/3/4 of the application.

The session stores only the application context needed to continue the current workflow:

- analyzed vacancy/job metadata;
- fit/recommendation result;
- generated application draft and the candidate's current cover-letter edit;
- recommended CV label;
- existing tracker vacancy ID when one has already been created.

It does **not** copy CV PDF bytes, reusable Application Memory, passwords, CAPTCHA/2FA answers, legal declarations or sensitive personal fields into the session record.

A session can restore when:

- the current page is the same analyzed vacancy; or
- the same tab moves to a URL that looks like an application step on the same origin; or
- the same tab moves between subdomains of the same recognized ATS family, such as `*.myworkdayjobs.com`, and the destination looks like an application step.

A different job-detail page on the same site is deliberately **not** treated as a continuation. Sessions expire after eight hours and are removed after the application is recorded as Applied. The popup shows when a multi-step session is active/restored and provides **Forget** to discard it manually.

The first v0.9 implementation is intentionally same-tab. Cross-tab/new-window ATS handoff is a separate reliability problem and is not guessed automatically.

## ATS-aware extraction

The extension prefers standards-based Schema.org `JobPosting` JSON-LD before relying on fragile visual selectors. It extracts title, company, description, location/country, remote status and experience hints when available, with ATS-specific and generic DOM fallbacks.

Host recognition includes HH.ru, Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Teamtailor, Recruitee, Workable and Personio. Malformed JSON-LD is ignored safely and falls back to DOM extraction.

## Custom ATS controls

Modern ARIA comboboxes, listbox-opening buttons and radiogroups are recognized so Workday/Personio/SmartRecruiters-style questions are not invisible. These controls remain deliberately **review-first**: the extension does not script clicks into ambiguous custom widgets.

Legal, verification/CAPTCHA, security, identity-document, demographic and medical questions remain blocked regardless of whether the employer renders them as native or custom controls.

## Verified safe autofill

The extension does not treat a programmatic input event as proof that a field was filled successfully. For fields classified as safe to fill it:

1. writes the intended value;
2. dispatches normal input/change/blur events;
3. waits briefly for the ATS/React UI to settle;
4. reads the field back;
5. compares the persisted value against the intended value with deterministic normalization.

The verifier understands common boolean variants such as `Yes` / `true` / `Да` and checks both underlying and visible select values where available. If a supposedly safe fill does not persist, the field becomes an **Autofill failed / Verify fill** checkpoint instead of silent success.

Native radio/checkbox alternatives are handled so a non-matching option in the same logical choice does not create a false failure warning.

## Automatic post-fill reconciliation

After **Fill safe fields**, the popup automatically rescans the employer form, rebuilds the field plan and rerenders submission readiness with the latest verified state.

A previously failed-fill warning can also be reconciled after the candidate manually corrects the field. The warning is cleared in the popup only when the current field value deterministically matches the truthful planned value. A different or blank value does not clear it, and employer-specific `review` fields are never promoted to safe merely because they contain text.

This reconciliation is intentionally local to the current application UI. It does not learn a new personal fact or weaken the backend resolver's safety classification.

## Submission-readiness checklist

The checklist distinguishes:

- **Checklist clear** — no unresolved detected fields or autofill failures remain;
- **Review needed** — employer-specific/custom controls or failed safe-autofill attempts need candidate verification;
- **Manual action** — blocked legal, security, CAPTCHA, medical or demographic questions must be handled manually.

When a review field already contains a value, the checklist marks it **Verify** rather than assuming the answer is correct. A safe-fill failure with a current value is marked **Verify fill**.

The checklist also carries a CV checkpoint. If the extension itself inserted a CV from the local vault, it shows the exact filename recorded by the extension and still requires visual confirmation on the employer page.

A clear checklist is not proof that the employer form is complete or safe to submit. It covers only controls the extension can detect. The final external Submit/Apply action remains candidate-controlled.

## Application Memory

**Remember confirmed answers** stores reusable answers in Chrome storage only after Violetta entered/confirmed them herself and explicitly asks the extension to remember them. Examples include phone number and LinkedIn URL when those values are not yet configured in the verified backend candidate profile.

Application Memory deliberately does **not** learn or reuse salary expectations, exact availability/start date, relocation commitments, commercial-experience years, criminal/legal declarations, passport/national-ID data, date of birth/age, medical/disability information, demographic answers, or security-clearance declarations.

## CV Vault

The local **CV Vault** keeps the English and Russian PDF variants in the Chrome extension profile. PDF bytes remain in `chrome.storage.local`; they are not uploaded to the Job Search Assistant backend.

**Upload recommended CV** selects the Russian or English vault entry based on the application draft and inserts it into the most likely résumé/CV file input after explicit user action. Always check that the employer site displays the correct filename before final submission.

## HH.ru direct submission

For an HH vacancy scoring **75/100 or higher**, the extension can show **Apply on HH via official API**. After explicit confirmation it imports the vacancy, reuses the selected HH resume, generates the vacancy-specific Russian draft, submits through HH's applicant-authorized API and records the application in the CRM.

HH OAuth and an HH resume must be configured first. The extension does not bypass CAPTCHA/2FA or imitate hidden browser clicks for HH submission.

## Daily queue

The backend exposes a ranked application queue at `/queue.html`, prioritizing unapplied jobs using fit, freshness and eligibility while excluding likely-ineligible opportunities.

## Install locally

1. Run the Job Search Assistant backend at `http://localhost:8080`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `browser-extension` folder.
6. Pin **Violetta Apply Assistant**.
7. Open **CV Vault setup** and store the English/Russian PDFs.

After updating extension code, click **Reload** on the extension card.

## Backend APIs used

- `GET /health`
- `GET /api/candidate`
- `POST /api/extension/analyze`
- `POST /api/extension/resolve-fields`
- `POST /api/import/hh`
- `POST /api/import/browser`
- `POST /api/vacancies/{id}/apply-tailored`
- `POST /api/vacancies/{id}/mark-applied`
- `GET /api/vacancies/{id}/application-draft`
- `GET /api/application-queue`

## Privacy model

Vacancy pages are not transmitted in the background. Page text/form metadata are sent to the configured backend only after the user requests analysis or a form action.

Reusable answers and CV Vault files remain in the local Chrome profile. Failed-fill tracking does not store intended personal values in DOM attributes. The multi-step context uses ephemeral `chrome.storage.session` rather than persistent local storage and expires automatically.

## Next iteration

- validate real multi-step application forms across Workday, SmartRecruiters, Teamtailor, Recruitee, Workable and Personio;
- add safe cross-tab/new-window session handoff where a deterministic ATS job identity can be preserved;
- add platform-specific adapters only where field/value mapping can be proven deterministic and safe;
- optional company-specific writing provider with deterministic truthful fallback;
- continue using outcome analytics to decide which sources, role families and CV variants deserve more applications.
