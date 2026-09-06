# Setup & Readiness — extension v2.0

The extension options page is now the operational setup center for Violetta Apply Assistant.

## What the system check verifies

The check reads only existing backend status/configuration and local extension state:

- backend readiness through `/health/ready`;
- verified candidate profile through `/api/candidate`;
- whether the English and Russian CV Vault slots exist locally;
- whether there are current 75+ unapplied opportunities in `/api/application-queue`;
- HH applicant authorization through `/api/hh/resumes`;
- whether an HH resume is selected in `/api/dashboard` state.

It does not read employer answers, passwords, CAPTCHA/2FA values, legal declarations, medical/demographic answers or CV PDF contents during the readiness check.

## Readiness states

### Ready to apply

The backend and verified candidate profile are available, both CV Vault variants are stored, and the strong-job queue has at least one opportunity.

HH authorization is intentionally optional for this state. A missing HH connection disables direct HH submission but does not block Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Personio or other external ATS workflows.

### Usable, but setup needs attention

Core backend/profile requirements are satisfied, but one or both CV Vault files are missing or the strong-job queue is empty. Applications can still be prepared manually, but the workflow will require more candidate intervention.

### Setup blocked

The backend is unavailable/not ready, or the verified core candidate profile is incomplete. The assistant should not be trusted for application preparation until the required item is fixed.

## Capabilities

The setup page reports four capabilities separately:

- **External ATS** — backend + candidate profile ready;
- **Both CVs ready** — English and Russian local PDFs stored;
- **Daily queue** — backend has at least one 75+ unapplied opportunity;
- **HH direct apply** — backend/profile ready, HH authorization works, and an HH resume is selected.

## Quick actions

The same page can:

- save/change the backend URL;
- open the backend dashboard;
- open the ranked apply queue;
- begin/refresh HH OAuth through the backend;
- manage both local CV Vault PDFs.

The final employer Submit/Apply action remains candidate-controlled on external ATS sites.
