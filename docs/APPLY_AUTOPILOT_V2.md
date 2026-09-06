# Apply Autopilot v2

## Goal

Make Violetta's Russia + Europe job search fast enough that most strong applications take roughly one review cycle instead of repeatedly retyping the same information.

The system uses three execution modes:

1. **API AUTO** — only where an official applicant-authorized API exists (currently HH.ru). Existing safety gates still apply.
2. **ONE-CLICK FILL** — Chrome extension analyzes the vacancy, recommends a CV/application angle, writes a vacancy-specific draft, and fills common fields. Violetta reviews and presses the final site Submit/Apply button.
3. **ASSISTED** — unusual ATS questions, legal declarations, exact salary/start date, CAPTCHAs, 2FA and employer-specific commitments stay with the candidate.

## Candidate truth source

The `Candidate` section in `appsettings.json` is the source of truth for application automation.

Verified positioning now includes:

- Violetta Nicolaou / Виолетта Николау / Βιολέττα Νικολάου
- Russian work authorization
- Cyprus/EU work authorization
- Russian, English and Greek fluent
- Programmer honours diploma, July 2026
- C# / .NET / ASP.NET Core / EF Core / SQL Server / REST / Git / Docker
- TypeScript / React / Next.js
- automated testing / CI
- DentalClinic real-client project

The system must never convert project experience into invented years of salaried commercial employment.

## Application language

- Russian / HH market → Russian name, Russian CV, Russian cover letter.
- EU / international market → English name, English CV, English cover letter.
- Greek remains a hiring advantage and can be surfaced when the vacancy mentions Greek, Cyprus, Greece or multilingual customer/team work.

## Current endpoints

### `GET /api/candidate`

Returns the non-secret autofill profile used by the browser extension.

### `GET /api/vacancies/{id}/application-draft`

Builds a vacancy-specific application package for a vacancy already stored in the CRM.

### `POST /api/extension/analyze`

Accepts page-extracted vacancy text and returns:

- match score
- eligibility status
- recommendation
- matched/missing skills
- recommended headline
- recommended CV
- short message
- cover letter
- common screening answers
- warnings to verify before submission

## Safety / quality gates

- `85–100`: Apply now
- `75–84`: Apply
- `65–74`: Review
- `<65`: Skip by default

Missing technologies may be acknowledged honestly but are never added to the candidate profile automatically.

The extension intentionally does **not** fill:

- exact salary expectations unless configured for a specific vacancy
- exact start date
- legal/criminal/medical declarations
- files/uploads in v0.1
- unverified LinkedIn profile
- arbitrary unknown yes/no questions

It never clicks the final Submit button.

## Next implementation batch

1. Use `ApplicationDraftService` for HH API submissions so auto-applied HH letters use the same natural tailoring engine.
2. Add application-question memory with explicit `safe reusable` vs `candidate must answer` classifications.
3. Add ATS-specific selectors for HH, Greenhouse, Lever and Ashby.
4. Add CV upload helper for the two known PDF variants.
5. Add one-click `Import to CRM` from the extension and `Mark Applied` after external submission.
6. Add optional LLM provider interface for deeper company-specific wording, with deterministic truthful fallback when no API key is configured.
7. Add daily application queue showing the top 10–20 strong matches and duplicate protection.
