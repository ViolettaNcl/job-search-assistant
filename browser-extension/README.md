# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

Version **2.7.2** supports two modes: a one-click browser application for the vacancy currently open, and the backend's optional all-day HH Apply Autopilot controlled from the redesigned local dashboard. Cover letters are short, human-sounding, and selected from the actual vacancy description instead of using one fixed developer template. On current HH pages, the extension waits for the post-response “Add cover letter” action, opens it, fills the letter prepared for that exact vacancy, and verifies the second Send step before recording the application as complete. Popup-to-page messages and local-server requests now have bounded timeouts, stale manual operations recover automatically, and the popup exposes a reset action instead of requiring extension removal.

The main popup button **Отправить отклик + письмо** performs the current-vacancy flow in one action: analyze, tailor, choose the HH resume or CV Vault file, fill verified-safe fields and click the final employer action only when it is unambiguous. It stops for unknown required answers, CAPTCHA, legal declarations, a missing CV, or an unverified submission result.

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

**Defer 4h** postpones a strong vacancy without pretending it was applied, rejected or permanently skipped.

A deferral:

- writes the vacancy as `Saved` through the existing status API;
- records an auditable `ApplicationEvent` note in the form `QueueDeferredUntil=<UTC timestamp>`;
- hides that vacancy from the ranked queue while the timestamp is in the future;
- automatically allows the vacancy back into the queue after the deferral expires;
- does not mark the vacancy Applied, Rejected or Skipped;
- does not cause an ordinary manually saved/bookmarked vacancy to reappear automatically.

No extra database column or migration is required. If the backend rejects a deferral, the current queue item stays available and the extension reports the failure instead of silently advancing.

## Multi-step ATS sessions

The active application context is stored in ephemeral `chrome.storage.session`. It keeps:

- analyzed vacancy/job metadata;
- fit and recommendation result;
- generated application draft and the candidate's current cover-letter edit;
- recommended CV label;
- existing tracker vacancy ID when one has already been created.

It does **not** copy CV PDF bytes, reusable Application Memory, passwords, CAPTCHA/2FA answers, legal declarations or sensitive personal fields into the session record.

### Same-tab continuation

When an ATS moves from the vacancy page into later application steps in the same tab, the popup can restore the existing session if the current URL is a valid continuation.

For shared ATS origins, version 1.2 also closes a previous ambiguity: same-origin alone is no longer sufficient when multiple employers share one host. The session must preserve the same derived employer/tenant identity.

### Safe cross-tab / new-window handoff

Version 1.2 supports a conservative new-tab handoff for ATS flows where the employer's Apply action opens another tab/window.

Automatic handoff requires all of the following:

1. the current tab has a real Chrome `openerTabId`;
2. that opener tab is exactly the tab holding the stored application session;
3. the destination URL looks like an application step;
4. the source and destination resolve to the same explicit ATS tenant/employer identity;
5. the session is still inside its eight-hour lifetime.

When those checks pass, the session is **moved** from the opener tab's storage slot into the new tab's slot rather than copied. This prevents the original tab from later restoring a stale duplicate.

Tenant identity is derived conservatively from either an employer-specific ATS hostname or from documented shared-host URL structure. Supported identities include:

- Workday employer subdomains such as `acme.wd5.myworkdayjobs.com`;
- Teamtailor employer subdomains;
- Recruitee employer subdomains;
- Personio employer subdomains;
- SmartRecruiters paths such as `jobs.smartrecruiters.com/<company>/...`;
- Lever paths such as `jobs.lever.co/<company>/...`;
- Ashby paths such as `jobs.ashbyhq.com/<company>/...`;
- Greenhouse paths such as `job-boards.greenhouse.io/<company>/...` or `boards.greenhouse.io/<company>/...`;
- Workable paths such as `apply.workable.com/<company>/...`.

A different employer on the same shared ATS host does not restore the session. A tab with no opener relationship also does not automatically claim another tab's application context.

This is intentionally stricter than scanning every open tab for a vaguely similar URL.

## External job sites

1. Open a vacancy in Chrome, either directly or through the daily loop.
2. Click **Violetta Apply Assistant**.
3. Click **Analyze this vacancy**.
4. The backend scores the job and creates a truthful role-specific application draft.
5. The extension scans the application form and reports safe, review and blocked fields.
6. Click **Fill safe fields**. The extension waits for the ATS UI to settle, verifies each attempted fill and automatically refreshes the checklist.
7. If the ATS moves to a compatible same-tab step or a safely linked new tab, reopen the extension and the application context is restored.
8. Correct any review/manual-only/failed-fill items yourself. **Recheck submission checklist** remains available after manual edits.
9. Click **Upload recommended CV** when a stored CV is available and verify the employer page shows the expected attachment.
10. Press **Отправить отклик + письмо** for the combined flow, or use the individual preparation controls when you want to inspect each step.
11. A confirmed submission is recorded in the CRM automatically. If the site does not provide a reliable receipt, inspect it and use **Record applied** only after you can see that it succeeded.

**Save to tracker** can store a vacancy before applying. Rich browser import keeps the job description, country/location, fit score and eligibility instead of saving only a shallow link. Duplicate source URLs reuse the existing CRM record.

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

Reusable answers and CV Vault files remain in the local Chrome profile. Multi-step application context uses ephemeral `chrome.storage.session` and expires automatically. Cross-tab handoff does not enumerate or inspect unrelated tabs; it follows only the browser-provided opener relationship and deterministic ATS tenant identity. Queue deferrals store only a vacancy status plus expiry note in the existing CRM event history.

## Next iteration

- validate real application forms and cross-tab behavior across Workday, SmartRecruiters, Teamtailor, Recruitee, Workable, Greenhouse, Lever, Ashby and Personio;
- add platform-specific adapters only where field/value mapping can be proven deterministic and safe;
- add a more flexible defer menu only if real usage shows 4 hours is too rigid;
- optional company-specific writing provider with deterministic truthful fallback;
- continue using outcome analytics to decide which sources, role families and CV variants deserve more applications.


Operator 2.7.0 moves qualification and project selection into backend services. Scores are explained priority indices, not hiring probabilities. Optional AI suggestions are available in the local dashboard, clearly labeled and review-only; normal extension drafts use verified project evidence with deterministic fallback. The popup's HH API button observer now avoids redundant class writes that could starve the browser event loop. See `docs/JOB_OPERATOR_AUDIT.md` for measured checks and the remaining real HH pilot gates.


2.7.1: HH vacancy pages automatically show a movable translucent panel. Drag its header (or focus it and use arrow keys), collapse with minus, or hide with ×. On another website, use “Показать панель на странице” in the toolbar popup. Position persists; the embedded popup remains bound to its original tab. Dashboard thresholds (50–100) and daily limits (1–200) are editable and survive polling/restarts. Lowering the threshold does not remove truth/eligibility gates. Search now runs as a background job and displays HH search errors explicitly.


2.7.2 adds “Проверка резюме для отбора” after vacancy analysis, including the floating panel. It shows each extracted requirement with repository-backed evidence, unsupported requirements and a plain-text project excerpt. Optionally paste the actual selected HH resume text to identify relevant verified terms not mentioned there. Synonyms are normalized. This is a limited deterministic text comparison, not an ATS emulator, PDF parser, rejection-cause detector or guarantee of recruiter visibility. It cannot inspect or change the selected HH resume. Private text is sent only to a loopback backend, is not persisted and never goes to an AI provider or employer. Existing submission gates remain unchanged.
