# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

Version **0.2** is a review-first application autopilot for Russia and Europe. It reads the vacancy only after the user clicks Analyze, asks the backend what can be answered safely, reuses confirmed answers, and keeps job-specific or sensitive questions out of automation.

## External job sites

1. Open a vacancy in Chrome.
2. Click **Violetta Apply Assistant**.
3. Click **Analyze this vacancy**.
4. The backend scores the job and creates a truthful role-specific application draft.
5. The extension scans the visible application form and reports:
   - fields safe to autofill;
   - fields that need review;
   - fields intentionally blocked from automation.
6. Click **Fill safe fields**.
7. Review anything left for you and press the website's final Submit/Apply button yourself.

## ATS-aware extraction

The content script now has dedicated page-detection adapters for:

- HH.ru
- Greenhouse
- Lever
- Ashby
- generic career/application pages

The adapters improve extraction of job title, company, description and location while keeping a generic fallback for other sites.

## Application Memory

**Remember confirmed answers** stores reusable answers locally in Chrome storage only after Violetta has entered them herself.

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
- medical/disability information
- demographic answers
- security-clearance declarations

The **Clear saved answers** button deletes reusable browser-side memory without changing the verified candidate profile.

## CV helper

The extension displays the CV variant recommended by the tailoring engine, for example:

- `Violetta_Nicolaou_CV_RU_v2.pdf`
- `Violetta_Nicolaou_CV_EN_v2.pdf`

**Find upload field** highlights the first visible file-upload control on the page. Chrome security rules do not allow an extension to silently choose a local file, so Violetta still selects the recommended PDF herself.

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

## Install locally

1. Run the Job Search Assistant backend at `http://localhost:8080`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `browser-extension` folder.
6. Pin **Violetta Apply Assistant** to the Chrome toolbar.

After updating the extension code, click **Reload** on the extension card in `chrome://extensions`.

## Backend APIs used

- `GET /health`
- `GET /api/candidate`
- `POST /api/extension/analyze`
- `POST /api/extension/resolve-fields`
- `POST /api/import/hh`
- `POST /api/vacancies/{id}/apply-tailored`
- `GET /api/vacancies/{id}/application-draft`

## Privacy model

The content script does not transmit vacancy pages in the background. Page text and form metadata are sent to the configured Job Search Assistant backend only after the user clicks **Analyze this vacancy** or requests a form action.

Reusable answers saved with Application Memory remain in this Chrome profile's local extension storage.

## Next iteration

- richer Greenhouse/Lever/Ashby field adapters based on real application forms
- application tracker import + Mark Applied for external sites
- optional LLM provider interface for deeper company-specific wording
- daily top-application queue
- configurable phone/LinkedIn in the verified candidate profile after the user confirms them
