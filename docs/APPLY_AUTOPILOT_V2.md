# Apply Autopilot v2

## Goal

Make Violetta's Russia + Europe job search fast enough that most strong applications take one short review cycle instead of repeatedly retyping the same information.

The system uses three execution modes:

1. **API AUTO** — only where an official applicant-authorized API exists (currently HH.ru). Existing safety gates still apply.
2. **ONE-CLICK FILL** — Chrome extension analyzes the vacancy, recommends a CV/application angle, writes a vacancy-specific draft, resolves form questions and fills only answers classified as safe.
3. **ASSISTED** — unusual ATS questions, legal declarations, salary/start date, CAPTCHAs, 2FA and employer-specific commitments stay with the candidate.

## Candidate truth source

The `Candidate` section in `appsettings.json` is the verified source of truth for application automation.

Verified positioning includes:

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
- Greek is surfaced as an advantage when relevant to Cyprus, Greece or multilingual work.

## Current endpoints

### `GET /api/candidate`

Returns the non-secret verified autofill profile used by the extension.

### `GET /api/vacancies/{id}/application-draft`

Builds a vacancy-specific application package for a CRM vacancy.

### `POST /api/extension/analyze`

Accepts page-extracted vacancy text and returns match score, eligibility, recommendation, matched/missing skills, recommended headline/CV and natural application copy.

### `POST /api/extension/resolve-fields`

Accepts visible application-field metadata plus the current application draft and user-confirmed browser memory.

Every field is classified as one of:

- `fill` — safe to autofill from verified facts, the vacancy-specific draft or confirmed reusable memory;
- `review` — candidate should inspect/answer before submission;
- `blocked` — sensitive/legal/security data that automation must not answer.

Examples deliberately kept out of automatic answers:

- salary expectations
- exact availability/start date
- relocation commitments
- years of commercial experience
- visa-status wording that is not clearly a work-authorization question
- criminal/background/security-clearance declarations
- passport/national-ID fields
- date of birth/age
- medical/disability data
- demographic answers

### `POST /api/vacancies/{id}/apply-tailored`

Submits a strong HH.ru vacancy through HH's applicant-authorized API using the selected HH resume and the same vacancy-specific drafting engine used by the extension. It blocks blacklisted companies, duplicates and vacancies below the one-click threshold.

## Chrome extension v0.2

The extension now includes:

- HH.ru adapter
- Greenhouse adapter
- Lever adapter
- Ashby adapter
- generic ATS/career-page fallback
- form scanning and field tokens
- backend field-resolution plan
- safe-only autofill
- visible counts for safe/review/blocked fields
- browser-local Application Memory for explicitly confirmed reusable answers
- CV variant recommendation
- upload-field highlighter
- HH official-API submission for strong jobs after explicit confirmation

## Application Memory

Application Memory lives in Chrome extension local storage for now. It does not alter the verified backend candidate profile.

A value is only stored when:

1. the resolver marks that field as reusable;
2. Violetta has entered/confirmed a value;
3. she explicitly clicks **Remember confirmed answers**.

The first intended reusable values are phone number and LinkedIn URL. The architecture can later move confirmed facts into the backend profile after an explicit profile-update flow.

## CV handling

The draft engine recommends either the Russian or English PDF filename.

The extension can find and highlight file-upload controls but cannot silently choose a local file because browsers prohibit scripts/extensions from setting local file inputs. Violetta selects the recommended file herself.

## Safety / quality gates

- `85–100`: Apply now
- `75–84`: Apply
- `65–74`: Review
- `<65`: Skip by default

Missing technologies may be acknowledged honestly but are never added to the candidate profile automatically.

For external job sites the extension never clicks the final Submit button. HH.ru is the explicit exception: after user confirmation, HH OAuth and resume selection, the dedicated HH button can submit via the official applicant API.

## Next implementation batch

1. One-click `Import to CRM` and `Mark Applied` from external job pages.
2. A daily top-application queue ranked by fit, freshness and eligibility.
3. Richer ATS adapters validated against real Greenhouse, Lever and Ashby forms.
4. Optional LLM provider interface for deeper company-specific wording with a deterministic truthful fallback.
5. Configurable verified phone/LinkedIn profile fields after the user confirms them.
6. Follow-up reminders for high-value applications with no reply after a defined number of working days.
