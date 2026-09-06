# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

Version **0.7** is a review-first application autopilot for Russia and Europe. It analyzes vacancies only after the user asks, creates truthful role-specific application material, reuses explicitly confirmed answers, autofills safe ATS fields, verifies that those fills actually persist, stores applications in the CRM, inserts the recommended CV from a local browser vault, and shows a conservative submission-readiness checklist before the candidate submits externally.

## External job sites

1. Open a vacancy in Chrome.
2. Click **Violetta Apply Assistant**.
3. Click **Analyze this vacancy**.
4. The backend scores the job and creates a truthful role-specific application draft.
5. The extension scans the application form and reports:
   - fields safe to autofill;
   - fields that need review;
   - fields intentionally blocked from automation.
6. Click **Fill safe fields**. The extension waits briefly and verifies that the visible ATS control kept the intended value.
7. Answer any review/manual-only fields yourself, then click **Recheck submission checklist**.
8. If the checklist reports an autofill verification failure, confirm or re-enter that field manually and recheck it.
9. Click **Upload recommended CV** when a stored CV is available.
10. Review the whole employer form and attachment, then press the website's final Submit/Apply button yourself.
11. Click **Mark applied** after submission so the application is recorded in the Job Search Assistant CRM.

**Save to tracker** can store the vacancy before you apply. Rich browser import keeps the job description, country/location, fit score and eligibility instead of saving only a shallow link. Duplicate source URLs reuse the existing CRM record.

## ATS-aware extraction

The extension prefers standards-based structured vacancy data before relying on fragile visual selectors. When a page publishes Schema.org `JobPosting` JSON-LD, the extension extracts title, company, description, location/country, remote status and experience hints from that structured record. ATS-specific CSS selectors and the generic DOM scanner remain fallbacks when structured data is absent or incomplete.

Host recognition currently identifies:

- HH.ru
- Greenhouse
- Lever
- Ashby
- Workday
- SmartRecruiters
- Teamtailor
- Recruitee
- Workable
- Personio
- generic career/application pages

This makes vacancy extraction less dependent on an ATS keeping the same React classes or visual markup. The parser is deterministic and covered by Node tests in GitHub Actions; malformed JSON-LD is ignored safely and falls back to DOM extraction.

## Custom ATS controls

Version 0.5 introduced recognition for modern non-native controls common on Workday, Personio, SmartRecruiters and similar sites while preserving the hardened Greenhouse/Lever/Ashby field scanner:

- ARIA `combobox` controls;
- styled buttons that open listboxes;
- ARIA `radiogroup` controls;
- labels connected through `aria-labelledby` / `aria-describedby`;
- hidden native radio inputs represented by visible labeled groups.

These controls are deliberately **review-first**. The extension includes them in the field analysis so they are no longer invisible, but it does not script clicks into custom dropdowns or radio widgets. Even a truthful known answer such as EU work authorization is left for manual selection when the ATS uses a custom interactive control. Native HTML selects/radios can still use the existing safe resolver when the answer is unambiguous.

Legal, verification/CAPTCHA, security, identity-document, demographic and medical questions remain blocked regardless of whether the employer renders them as native fields or custom controls.

## Verified safe autofill

Version 0.7 no longer treats a programmatic input event as proof that the field was filled successfully.

For fields classified as safe to fill, the extension:

1. writes the intended value using the existing native-input/select handling;
2. dispatches the normal input/change/blur events;
3. waits briefly for the ATS/React UI to settle;
4. reads the current visible field value again;
5. compares the persisted value against the intended value using deterministic normalization.

The verifier understands common boolean variants such as `Yes` / `true` / `Да` and can compare both the underlying `<select>` value and its visible option text. If the ATS rejects or rewrites a supposedly safe fill, that field is remembered locally for the current page as an **Autofill failed / Verify fill** checkpoint. The backend does not receive or learn a new personal answer from this mechanism.

This deliberately favors a false warning over silently submitting a field that did not stick.

## Submission-readiness checklist

Version 0.6 introduced a concrete pre-submit checkpoint; version 0.7 also includes failed safe-autofill verification in that checklist.

The checklist distinguishes:

- **Checklist clear** — no unresolved fields or detected autofill failures remain;
- **Review needed** — employer-specific/custom controls or a failed safe-autofill attempt still require candidate verification;
- **Manual action** — blocked fields such as legal, security, CAPTCHA, medical or demographic questions must be handled manually.

When a review field already contains a value, the checklist marks it as **Verify** rather than assuming the answer is correct. A safe-fill failure with a current value is marked **Verify fill**. The **Recheck submission checklist** button rescans the current form after the candidate has made manual changes.

The checklist also carries a CV checkpoint. If the extension itself inserted a CV from the local vault, it shows the exact filename recorded by the extension and still instructs the candidate to verify that the employer page displays the same attachment. If an upload field is detected but no insertion was recorded, the checklist warns that the recommended CV still needs verification.

A clear checklist is deliberately not described as proof that the employer form is safe to submit. It covers only controls the extension can detect. The final external Submit/Apply action remains candidate-controlled.

## Application Memory

**Remember confirmed answers** stores reusable answers in Chrome storage only after Violetta has entered/confirmed them herself and explicitly asks the extension to remember them.

Initial examples include:

- phone number
- LinkedIn URL

Verified identity, email, GitHub, portfolio, citizenship/work authorization, languages and education continue to come from the backend candidate profile instead of being learned from forms.

Application Memory deliberately does **not** learn or reuse:

- salary expectations
- exact availability/start date
- relocation commitments
- years of commercial experience
- criminal/legal declarations
- passport/national-ID data
- date of birth/age
- medical/disability information
- demographic answers
- security-clearance declarations

The **Clear saved answers** button deletes reusable browser-side memory without changing the verified candidate profile.

## CV Vault

The local **CV Vault** keeps the two PDF variants in the browser extension profile.

Open **CV Vault setup** from the extension and choose the two PDF variants once:

- English CV for European/international applications
- Russian CV for Russia/HH.ru and Russian-language applications

The PDF bytes are stored in `chrome.storage.local` in the extension profile. They are not uploaded to the Job Search Assistant backend.

After analysis, **Upload recommended CV** selects the Russian or English vault entry based on the application draft and inserts it into the most likely résumé/CV file input. The uploader supports ATS pages where the real file input is visually hidden behind a styled upload button, while avoiding ambiguous multi-file forms when it cannot identify a résumé field confidently.

Always check that the employer site shows the correct filename before final submission.

## HH.ru direct submission

For an HH vacancy scoring **75/100 or higher**, the extension can show:

**Apply on HH via official API**

After explicit confirmation it:

1. imports the vacancy into Job Assistant;
2. reuses the selected HH resume;
3. generates the vacancy-specific Russian application draft;
4. submits through HH's applicant-authorized API;
5. records the application in the CRM.

HH OAuth and an HH resume must be configured first. The extension does not bypass CAPTCHA/2FA or imitate hidden browser clicks for HH submission.

## Daily queue

The backend also exposes a ranked application queue at:

`/queue.html`

It prioritizes unapplied jobs using fit, freshness and eligibility while excluding likely-ineligible opportunities. This is intended to become the daily “what should I apply to first?” screen.

## Install locally

1. Run the Job Search Assistant backend at `http://localhost:8080`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `browser-extension` folder.
6. Pin **Violetta Apply Assistant** to the Chrome toolbar.
7. Open **CV Vault setup** and store the English/Russian PDF copies.

After updating the extension code, click **Reload** on the extension card in `chrome://extensions`.

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

The content script does not transmit vacancy pages in the background. Page text and form metadata are sent to the configured Job Search Assistant backend only after the user clicks **Analyze this vacancy** or requests a form action.

Reusable answers, CV Vault files and the page-local failed-fill markers remain in this Chrome profile/page context. A stored CV is exposed to the currently open page only when the user explicitly clicks **Upload recommended CV**. Failed-fill tracking does not store the intended personal value in DOM attributes.

## Next iteration

- validate real application forms across Workday, SmartRecruiters, Teamtailor, Recruitee, Workable and Personio
- add platform-specific adapters only where field/value mapping can be proven deterministic and safe
- optional company-specific writing provider with deterministic truthful fallback
- continue using outcome analytics to decide which sources, role families and CV variants deserve more applications
