# Violetta Apply Assistant — Chrome Extension 4.0.0

`extension/` is the packaged Chrome runtime inside the FULL bundle. In the Git source repository the same source is published as `browser-extension/`.

## 4.0 search-page workflow

- `⚡ Analyze page` — bounded batch analysis of unique visible HH vacancy IDs.
- Explainable `rules-v1` Fit Score with reasons and risks.
- Local Job Preference Profile.
- Filters: all / no calls / fit threshold / ready / saved.
- User-controlled Ready to Apply queue with Apply / Show / Save / Skip.

## Existing protected capabilities

- exact full-vacancy `Analysis`;
- HH API fallback;
- `✦ Отклик + письмо`;
- persistent vacancy/application/questionnaire memory;
- Smart Questionnaire Autofill and reviewable human drafts;
- employer-already-viewed handling;
- recruiter-chat `✎ AI` drafts;
- optional local/backend advanced mode.

## Important

Fit Score 4.0 is deterministic and explainable. It is not a trained machine-learning model. The structured 4.0 data will feed the planned 4.1 Learning Engine.

## Installation

Chrome → `chrome://extensions` → Developer mode → Load unpacked → choose this `extension` directory.
