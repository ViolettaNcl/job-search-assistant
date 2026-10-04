# ML Architecture · 5.2

## Mechanisms are kept separate

1. deterministic safety/ranking rules;
2. bounded user-derived personal signals;
3. LLM-assisted writing/semantic generation where configured;
4. exact/semantic retrieval;
5. trained ML models.

Only item 5 is called ML.

## Model A — Personal Vacancy Preference

Target: `P(user_would_apply | vacancy)`.

Baseline: logistic regression over structured and deterministic hashed features. The browser implements the same SHA-256-based feature hashing as the Python trainer, allowing imported model JSON to score vacancies consistently.

Runtime use is conservative: the promoted model contributes a bounded portion of Fit and never overrides hard Calls/Sales gates.

## Model B — Employer Engagement

Target: `P(meaningful_employer_engagement | application)`.

It is trained from outcome labels and stays separate from preference Fit. Runtime output can be surfaced as an additional advisory signal.

## End-to-end lifecycle

```text
real LearningEvents
→ dataset export
→ dataset validation
→ stratified temporal train/calibration/test split
→ train candidate baseline
→ temperature + threshold calibration on calibration split
→ one held-out test evaluation
→ versioned candidate model + metrics
→ model registry
→ explicit promotion gate
→ runtime inference
→ later real labels
→ monitoring / calibration / drift
→ retraining proposal
```

## Model artifact

A model JSON contains model type/version, dimension, weights/bias, threshold, calibration metadata, dataset/training metadata and evaluation metrics. Registry metadata includes SHA-256.

## Promotion

Promotion requires a real-label model and sufficient held-out validation evidence. A candidate cannot silently replace the active model. Preference and engagement have independent active slots.

## Test-only training

Synthetic fixtures are useful for testing pipeline mechanics only. `--test-only` outputs remain `trainedOnRealLabels=false`; promotion refuses them.
