# Violetta Apply Assistant — Chrome Extension 5.2.0

`extension/` is the packaged Chrome runtime in the FULL bundle. The same source is published to `browser-extension/` in Git.

## Search

- exact per-card `Analysis`;
- `⚡ Analyze page` with bounded concurrency;
- separate Fit and Calls indicators;
- deterministic base Fit + bounded real-user preference signals;
- optional explicitly-promoted preference-model contribution;
- separate optional employer-engagement prediction;
- filters and Ready Queue;
- Save / Skip / Fit feedback learning signals.

## Apply / forms

- exact vacancy-specific `✦ Отклик + письмо`;
- persistent vacancy/application memory;
- Smart Questionnaire Autofill;
- confirmed-answer retrieval, including local semantic fallback;
- trusted user-correction learning;
- review-safe human drafts;
- pre-submit change summary;
- employer-already-viewed recovery.

## Learning & Model Center

The popup exposes local learning statistics, preference/engagement dataset export, backup/import/reset, model-candidate import, explicit promotion/disable and post-promotion monitoring/drift when real labels exist.

Importing a model never activates it automatically. Test-only/synthetic models are rejected by the promotion gate.

## Recruiter / interview

Recruiter intent and Interview Prep use vacancy context and confirmed profile evidence. Mock-practice feedback evaluates answer structure/evidence grounding only.

## Installation

Chrome → `chrome://extensions` → Developer mode → Load unpacked → select this `extension` directory.
