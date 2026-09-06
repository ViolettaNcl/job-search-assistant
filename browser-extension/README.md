# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

Version **1.1** is a review-first application autopilot for Russia and Europe. It uses the backend's ranked vacancy queue to make the daily workflow continuous: open the next strong job, analyze it, tailor the application, safely fill what can be verified, preserve context across compatible ATS steps, record the application, then advance to the next strong unapplied vacancy.

## Daily apply loop

The popup shows the strongest **75+** unapplied job from the backend queue.

The normal loop is:

1. Click **Open next strong job**.
2. The vacancy opens in a new tab, leaving an unfinished application tab intact.
3. Analyze the vacancy and complete the review-first application workflow.
4. Submit externally yourself, or use the supported HH official API flow when available.
5. Click **Mark applied** for an external application.
6. The queue card refreshes automatically and advances to the next strong unapplied job.

The popup calls `GET /api/application-queue?limit=20&minScore=75` and respects the backend's fit, freshness and eligibility ranking. The browser-side selector only removes invalid URLs, likely-ineligible entries, jobs below 75 and the vacancy already open/analyzed in the current workflow.

**Full queue** opens the broader ranked shortlist. Opening a vacancy is always an explicit user action; the extension does not launch vacancies in the background and does not automatically submit external ATS forms.

## Temporary queue deferral

Version 1.1 adds **Defer 4h** for a strong vacancy that should stay in the pipeline but should not block the current application session.

A deferral:

- writes the vacancy as `Saved` through the existing status API;
- records an auditable `ApplicationEvent` note in the form `QueueDeferredUntil=<UTC timestamp>`;
- hides that vacancy from the ranked queue while the timestamp is in the future;
- automatically allows the vacancy back into the queue after the deferral expires;
- does not mark the vacancy Applied, Rejected or Skipped;
- does not cause an ordinary manually saved/bookmarked vacancy to reappear automatically.

No extra database column or migration is required. The behavior uses the existing vacancy status and application-event history.

The popup sends the deferral only after an explicit **Defer 4h** click. If the backend rejects the status update, the current queue item remains available and the extension reports the failure instead of silently advancing.

## External job sites

1. Open a vacancy in Chrome, either directly or through the daily loop.
2. Click **Violetta Apply Assistant**.
3. Click **Analyze this vacancy**.
4. The backend scores the job and creates a truthful role-specific application draft.
5. The extension scans the application form and reports safe, review and blocked fields.
6. Click **Fill safe fields**. The extension waits for the ATS UI to settle, verifies each attempted fill and automatically refreshes the checklist.
7. If the ATS moves to another compatible application step in the same browser tab, reopen the extension: the vacancy, fit score, edited cover letter, CV recommendation and tracker context are restored automatically.
8. Correct any review/manual-only/failed-fill items yourself. **Recheck submission checklist** remains available after manual edits.
9. Click **Upload recommended CV** when a stored CV is available and verify the employer page shows the expected attachment.
10. Review the entire employer form, then press the website's final Submit/Apply button yourself.
11. Click **Mark applied** after submission so the application is recorded in the CRM and the daily queue can advance.

**Save to tracker** can store a vacancy before applying. Rich browser import keeps the job description, country/location, fit score and eligibility instead of saving only a shallow link. Duplicate source URLs reuse the existing CRM record.

## Multi-step ATS sessions

The active application context is kept in `chrome.storage.session`, keyed to the current browser tab. This prevents Workday/SmartRecruiters/Personio-style flows from losing the original vacancy context after the job-description page disappears.

The session stores:

- analyzed vacancy/job metadata;
- fit and recommendation result;
- generated application draft and the candidate's current cover-letter edit;
- recommended CV label;
- existing tracker vacancy ID when one has already been created.

It does **not** copy CV PDF bytes, reusable Application Memory, passwords, CAPTCHA/2FA answers, legal declarations or sensitive personal fields into the session record.

A session can restore on the same analyzed vacancy, on an application-looking URL on the same origin, or for selected ATS families when a cross-subdomain transition preserves the same employer/tenant identity. Workday restoration is tenant-bound so one employer's context cannot bleed into another employer's Workday site.

A different job-detail page is not treated as a continuation. Sessions expire after eight hours and are removed after the application is recorded as Applied. **Forget** discards a session manually.

The current implementation is intentionally same-tab. Cross-tab/new-window ATS handoff is not guessed automatically.

## ATS-aware extraction and controls

The extension prefers Schema.org `JobPosting` JSON-LD before fragile visual selectors. It extracts title, company, description, location/country, remote status and experience hints when available, with ATS-specific and generic DOM fallbacks.

Host recognition includes HH.ru, Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Teamtailor, Recruitee, Workable and Personio. Malformed JSON-LD is ignored safely and falls back to DOM extraction.

Modern ARIA comboboxes, listbox-opening buttons and radiogroups are recognized so custom ATS questions are not invisible. These controls remain review-first: the extension does not script ambiguous choices.

Legal, verification/CAPTCHA, security, identity-document, demographic and medical questions remain blocked regardless of whether they are native or custom controls.

## Verified safe autofill

For a field classified as safe, the extension:

1. writes the intended value;
2. dispatches normal input/change/blur events;
3. waits for the ATS/React UI to settle;
4. reads the field back;
5. compares the persisted value against the intended value.

If a supposedly safe fill does not persist, the field becomes an **Autofill failed / Verify fill** checkpoint instead of silent success. Native radio/checkbox alternatives and common boolean variants are handled deterministically.

## Submission readiness

The checklist distinguishes:

- **Checklist clear** — no unresolved detected fields or autofill failures remain;
- **Review needed** — employer-specific/custom controls or failed safe-autofill attempts need candidate verification;
- **Manual action** — blocked legal, security, CAPTCHA, medical or demographic questions must be handled manually.

A clear checklist is not proof that the entire employer form is complete. The final external Submit/Apply action remains candidate-controlled.

## Application Memory

**Remember confirmed answers** stores reusable answers in Chrome storage only after Violetta entered/confirmed them herself and explicitly asks the extension to remember them.

Application Memory deliberately does **not** learn or reuse salary expectations, exact availability/start date, relocation commitments, commercial-experience years, criminal/legal declarations, passport/national-ID data, date of birth/age, medical/disability information, demographic answers or security-clearance declarations.

## CV Vault

The local **CV Vault** keeps the English and Russian PDF variants in the Chrome extension profile. PDF bytes remain in `chrome.storage.local`; they are not uploaded to the Job Search Assistant backend.

**Upload recommended CV** selects the Russian or English vault entry from the application draft and inserts it into the most likely résumé/CV input after explicit user action. Always verify the employer page shows the expected filename before final submission.

## HH.ru direct submission

For an HH vacancy scoring **75/100 or higher**, the extension can show **Apply on HH via official API**. After explicit confirmation it imports the vacancy, reuses the selected HH resume, generates the vacancy-specific Russian draft, submits through HH's applicant-authorized API and records the application in the CRM.

HH OAuth and an HH resume must be configured first. The extension does not bypass CAPTCHA/2FA or imitate hidden browser clicks.

## Install locally

1. Run the backend at `http://localhost:8080`.
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
- `GET /api/application-queue?limit=20&minScore=75`
- `POST /api/extension/analyze`
- `POST /api/extension/resolve-fields`
- `POST /api/import/hh`
- `POST /api/import/browser`
- `POST /api/vacancies/{id}/status` — including temporary queue deferrals
- `POST /api/vacancies/{id}/apply-tailored`
- `POST /api/vacancies/{id}/mark-applied`
- `GET /api/vacancies/{id}/application-draft`

## Privacy and safety model

Vacancy pages are not transmitted in the background. Page text/form metadata are sent to the configured backend only after the user requests analysis or a form action.

Reusable answers and CV Vault files remain in the local Chrome profile. Multi-step application context uses ephemeral `chrome.storage.session` and expires automatically. Queue deferrals store only a vacancy status plus expiry note in the existing CRM event history.

## Next iteration

- validate real application forms across Workday, SmartRecruiters, Teamtailor, Recruitee, Workable and Personio;
- add safe cross-tab/new-window session handoff where deterministic ATS job identity can be preserved;
- add platform-specific adapters only where field/value mapping can be proven deterministic and safe;
- add a more flexible defer menu only if real usage shows 4 hours is too rigid;
- optional company-specific writing provider with deterministic truthful fallback;
- continue using outcome analytics to decide which sources, role families and CV variants deserve more applications.
