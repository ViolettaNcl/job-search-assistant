# What Changed · 5.0.0 Foundation

## Product

- Added Personal Learning Engine event store.
- Apply / Save / Skip now create structured preference signals.
- Added explicit ✓ / ✕ Fit feedback.
- Fit personalization uses bounded explainable learning adjustments.
- Split Fit and Calls into separate visible chips.
- Added Learning Center with data export/import/reset.
- Added outcome analytics v2 with sample-size warning.
- Added duplicate/repost advisory across different vacancy IDs.
- Added recruiter intent classification and interview-prep foundation.
- Added formal multi-site adapter contract.

## ML foundation

- Added real logistic-regression training pipeline under `tools/ml/`.
- Added dataset validation, offline evaluation, registry and promotion gate.
- Synthetic test models are explicitly non-promotable.
- No production ML model is claimed when no real validated model is active.

## Safety / integrity

- Existing exact-vacancy, calls, questionnaire and application protections remain in place.
- Learning does not rewrite candidate facts.
- Outcome target is kept separate from user-preference target.
- Learning reset does not delete applications or CVs.
