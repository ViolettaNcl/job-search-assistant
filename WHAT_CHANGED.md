# What Changed · 4.0.0

## Batch Analysis

- Added `⚡ Analyze page` to HH search results.
- Unique vacancy IDs are analyzed with bounded concurrency instead of opening a visible tab for every card.
- Existing full-vacancy acquisition remains the source of truth: hidden DOM and exact HH API fallback.
- Repeated cards share vacancy-ID memory.

## Explainable Fit Score

- Added deterministic `rules-v1` Fit Score.
- Score inputs include role family, confirmed candidate skills, remote/office format, calls, sales, seniority, explicit experience years and English requirements when detectable.
- Every score includes `reasons` and `risks`.
- Confirmed calls are a hard negative when the user preference is to avoid calls.
- The release explicitly does **not** label this rules engine as machine learning.

## Job Preference Profile

Added local preferences for:

- minimum Fit threshold;
- avoid calls;
- avoid sales;
- remote preference;
- whether office roles are allowed;
- Batch Analysis concurrency.

Changing preferences invalidates the cached Fit calculation for the vacancy while preserving the underlying vacancy memory.

## Search filters and Apply Queue

- Added filters: All, no calls, Fit above threshold, Ready to Apply, Saved.
- Added user-controlled Ready to Apply panel.
- Queue actions: Apply, Show, Save, Skip.
- Save/Skip/Review decisions persist by vacancy ID and create structured signals for the future 4.1 Learning Engine.
- 4.0 does not mass-submit applications.

## Persistent structured vacancy intelligence

Added `vjaVacancyIntel:<vacancyId>` with:

- vacancy summary;
- phone-duty Analysis;
- Fit Score;
- structured feature snapshot;
- source/timestamp;
- preference version key.

## Documentation

Added/expanded documentation for the 4.0 ranking layer and future learning/ML boundaries:

- `docs/DATA_MODEL.md`
- `docs/LEARNING_SYSTEM.md`
- `docs/ML_ARCHITECTURE.md`
- `docs/MODEL_EVALUATION.md`

## Preserved 3.9.x behaviour

- exact-card Analysis;
- HH API fallback;
- `✦ Отклик + письмо`;
- employer-already-viewed guard;
- persistent application/form memory;
- Smart Questionnaire Autofill;
- Human Fallback Drafts;
- recruiter-chat drafts.
