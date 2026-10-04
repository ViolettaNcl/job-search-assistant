# What Changed · 5.2.0 Production Learning Loop

5.2 turns the 5.0 ML foundation into an end-to-end operational loop without pretending that a personal model is already good before real data exists.

## Model operations

- Added runtime inference compatible with the Python hashed-feature baseline.
- Added local candidate-model import and explicit promotion/disable controls.
- Model Registry upgraded to separate preference and employer-engagement active models.
- Promotion requires real-label metadata and held-out quality gates.
- Added calibration/threshold tuning and a full train/calibration/test pipeline.
- Added independent employer-engagement training target.
- Added post-prediction metrics, calibration/drift summary and retraining proposals.

## Learning quality

- Preference dataset now collapses repeated vacancy preference decisions to the latest label.
- Outcome/engagement labels remain separate from preference labels.
- Questionnaire user edits are captured as correction learning events.
- Confirmed generic questionnaire answers can use local semantic hash-vector retrieval when exact keys differ.

## User review

- Added pre-submit diff summary for fields/CV/cover-letter review.
- Added stronger mock-interview practice UI with structure/evidence feedback.
- Learning Center now exposes model registry, monitoring, datasets and model controls.

## Safety

- Calls/Sales hard gates remain deterministic.
- Preference ML contributes only a bounded part of Fit.
- Engagement prediction is shown separately and does not alter preference Fit.
- Synthetic/test-only models cannot be promoted.
- No silent online retraining or automatic model replacement was added.
