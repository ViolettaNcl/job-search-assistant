# Violetta Apply Assistant — Chrome Extension 3.9.13

`extension/` is the packaged Chrome runtime used by the FULL bundle. In the GitHub source repository the same extension source is published under `browser-extension/`.

## Main capabilities

- HH search-card `Analysis` using exact vacancy ID and full-vacancy reading.
- `✦ Отклик + письмо` with vacancy-specific evidence-based cover letters.
- Persistent vacancy/application/questionnaire memory.
- Smart Questionnaire Autofill with confirmed answers and reviewable Human Fallback Drafts.
- Known `Отклик уже просмотрен работодателем` modal handling.
- Recruiter-chat `✎ AI` drafts without automatic Send.
- Optional local/backend advanced mode.

## Questionnaire behavior

Confirmed candidate facts are preferred. Reviewable free-text drafts may be generated when evidence is insufficient, but the extension does not invent legal/identity facts, numeric salary values, years of experience or other verifiable personal data.

## Installation

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select this `extension` directory.

For source/development installation from GitHub select `browser-extension/` instead.

## Documentation

See the repository root:

- `README.md`
- `docs/USER_GUIDE.md`
- `docs/FEATURES.md`
- `ARCHITECTURE.md`
- `TESTING_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
