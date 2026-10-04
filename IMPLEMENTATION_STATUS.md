# Implementation Status · 5.2.0

## Implemented and regression-covered

### Search / HH workflow
- Exact vacancyId binding.
- Full vacancy reader with hidden-tab and `api.hh.ru` fallback.
- Calls / no-calls / unknown classification.
- Batch Analysis with bounded concurrency.
- Explainable base Fit Score and explicit Fit-vs-Calls UI.
- Ready Queue, Save, Skip, Apply and persistent vacancy memory.
- Cross-ID duplicate/repost advisory.

### Applications
- Vacancy-specific cover letters.
- Employer-already-viewed recovery.
- Questionnaire classification/autofill.
- Review-safe human fallback drafts.
- Confirmed-answer memory and local semantic fallback retrieval.
- Trusted user correction capture.
- Pre-submit field-change summary and final review gate.

### Personal learning
- Structured LearningEvent store.
- Apply/Save/Skip implicit labels and explicit Fit feedback.
- Bounded preference signals.
- Preference dataset and independent engagement dataset exports.
- Learning backup/import/reset.

### Model lifecycle
- Preference logistic baseline.
- Employer-engagement logistic baseline.
- Dataset validation.
- Temporal/stratified training pipeline.
- Calibration and threshold tuning.
- Held-out evaluation.
- Model Registry schema v2 with separate preference/engagement active slots.
- Candidate model import into extension.
- Explicit real-label promotion gate.
- Runtime inference for promoted models.
- Prediction monitoring, calibration/drift summary and retraining proposal.
- Synthetic/test-only model promotion rejection.

### Recruiter/interview
- Recruiter message intent classification.
- Vacancy-grounded interview-prep plan.
- Local mock-answer structure feedback.

### Engineering
- Repository hygiene checks.
- Source-only publisher with hashed allowlist.
- Documentation for learning/model operations.

## Intentionally not claimed

- No bundled “smart personal model” is claimed before enough real user labels exist.
- No silent online retraining or automatic promotion.
- No live production-quality metric is reported from synthetic fixtures.
- HH is the primary validated provider; additional sites require live adapter validation.
- Mock interview feedback evaluates answer structure, not human intelligence/fitness/competence.

## What remains data-dependent

The engineering loop is present. The remaining improvement is operational rather than another fake feature layer: collect real labelled decisions/outcomes, train candidate models, validate on held-out data, explicitly promote good models, observe post-promotion calibration/drift, and retrain only when evidence justifies it.
