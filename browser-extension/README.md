# Violetta Apply Assistant — Chrome extension

This extension is the browser companion for `job-search-assistant`.

It is intentionally a **review-first autopilot**:

1. Open a job vacancy in Chrome.
2. Click **Violetta Apply Assistant**.
3. Click **Analyze this vacancy**.
4. The backend scores the vacancy and prepares a truthful, role-specific application draft.
5. Click **Fill application** to fill common form fields.
6. Review the form and press the website's final Submit/Apply button yourself.

The extension never fabricates experience and never presses the final submission button. HH.ru direct submission remains available through the backend's official HH applicant API when OAuth, resume selection and automatic-submission safety settings are configured.

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
- `GET /api/vacancies/{id}/application-draft`

## Privacy model

The content script does not transmit pages in the background. Page text is extracted and sent to the configured Job Search Assistant backend only after the user clicks **Analyze this vacancy**.

## Next iteration

- ATS-specific adapters for HH, Greenhouse, Lever and Ashby
- CV file recommendation/upload helper
- application-question memory
- employer-specific answer templates
- one-click import into the application tracker
- optional local LLM/API provider for deeper natural-language tailoring
