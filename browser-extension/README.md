# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

It uses two application modes:

### External job sites

1. Open a vacancy in Chrome.
2. Click **Violetta Apply Assistant**.
3. Click **Analyze this vacancy**.
4. The backend scores the vacancy and prepares a truthful, role-specific application draft.
5. Click **Fill application** to fill common fields.
6. Review the form and press the website's final Submit/Apply button yourself.

### HH.ru

For an HH vacancy scoring **75/100 or higher**, the extension also shows:

**Apply on HH via official API**

After an explicit confirmation it:

1. imports the HH vacancy into Job Assistant;
2. reuses the selected HH resume;
3. generates the vacancy-specific Russian application draft;
4. submits through HH's applicant-authorized API;
5. records the application in the CRM.

HH OAuth and an HH resume must be configured first. The extension does not bypass CAPTCHA/2FA or imitate browser clicks for the HH submission.

## Install locally

1. Run the Job Search Assistant backend at `http://localhost:8080`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this `browser-extension` folder.
6. Pin **Violetta Apply Assistant** to the Chrome toolbar.

## What it can fill

The first version recognizes common fields such as:

- first / last / full name
- email
- GitHub
- portfolio / personal website
- city / location
- cover letter / motivation letter
- "why this role" style text areas
- common Russia/EU work-authorization questions
- sponsorship yes/no questions when the wording is clear

It deliberately leaves salary, exact start dates, LinkedIn (when not configured), legal declarations, files/uploads and unusual employer-specific questions for review.

## Backend APIs used

- `GET /health`
- `GET /api/candidate`
- `POST /api/extension/analyze`
- `POST /api/import/hh`
- `POST /api/vacancies/{id}/apply-tailored`
- `GET /api/vacancies/{id}/application-draft`

## Privacy model

The content script does not transmit pages in the background. Page text is extracted and sent to the configured Job Search Assistant backend only after the user clicks **Analyze this vacancy**.

## Next iteration

- ATS-specific adapters for Greenhouse, Lever and Ashby
- CV file recommendation/upload helper
- application-question memory
- employer-specific answer templates
- one-click import into the CRM for external vacancies
- optional local LLM/API provider for deeper company-specific wording
