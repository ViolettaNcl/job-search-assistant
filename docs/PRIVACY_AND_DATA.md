# Privacy and Local Data

Violetta Apply Assistant keeps candidate context and job-search memory locally in the extension so it can prepare letters, questionnaires, recruiter-chat drafts, and restore vacancy state.

## 4.0 local intelligence data

Version 4.0 adds local structured job-search intelligence. Typical keys include:

- `vjaJobPreferencesV1` — editable job-search preferences;
- `vjaVacancyIntel:<vacancyId>` — exact-vacancy Analysis, extracted features and Fit Score;
- `vjaVacancyDecision:<vacancyId>` — Saved / Skipped / Reviewed decisions.

The 4.0 Fit Score is deterministic `rules-v1`. **These records are not evidence that a machine-learning model has been trained.** They are the clean structured signals needed for the later 4.1 Personal Learning Engine.

## Candidate data

A FULL bundle may contain:

- CV assets;
- Candidate Truth / candidate seed;
- local profile defaults;
- application and questionnaire memory.

The current packaged extension remains personalized. Treat its contents as private candidate data.

## GitHub visibility

If the repository is temporarily public, any tracked CV/candidate files become publicly accessible. Switching the repository back to private does not undo earlier exposure or remove copies that may already have been downloaded.

The planned privacy architecture moves candidate documents, personal facts, learning events and future model datasets into a local private vault, for example under `%LOCALAPPDATA%\ViolettaApplyAssistant\`, while GitHub keeps only code, schemas, tests and non-personal templates.

## Secrets

Do not commit:

- API keys;
- `.env` files;
- `user-settings.cmd`;
- `candidate.private.json`;
- `appsettings.local.json`;
- browser session cookies or authentication tokens.

Publisher and repository-hygiene rules block the known private/runtime paths, but repository visibility and commit contents should still be reviewed before publishing.

## Future learning controls

Before 4.1/5.0 model learning becomes active, the product should expose explicit controls for:

- export local learning data;
- reset learning;
- delete local learning data;
- import/export a backup;
- inspect which events are used as training labels.

Production models must never be retrained silently from every click. New labels should be accumulated, evaluated offline, and promoted only after the candidate model beats the current baseline.
