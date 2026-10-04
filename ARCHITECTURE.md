# Architecture · 5.2.0 Production Learning Loop

## Runtime flow

```text
Job-site DOM / HH API
  ↓
Site adapter + exact vacancy identity
  ↓
Full Vacancy Reader
  ↓
Deterministic safety analysis (Calls / Sales / factual constraints)
  ↓
Structured feature extraction
  ↓
Base explainable Fit Score
  ↓
Bounded personal signals from real feedback
  ↓
Optional explicitly-promoted preference model (bounded blend)
  ↓
Search UI / Ready Queue / Apply
  ↓
Application + Questionnaire + Pre-submit Diff
  ↓
Recruiter / Interview workflow
  ↓
Outcome Timeline + Learning Events
  ↓
Learning & Model Center
  ↓
Dataset export → offline ML pipeline → registry → explicit promotion
  ↓
Runtime monitoring / drift / retraining proposal
```

## Extension modules

### Vacancy/search intelligence

- `hh-list-quick-apply*.js` — exact-card apply and full-vacancy preparation.
- `vacancy-fit.js` — deterministic rules-v1 Fit Score.
- `job-search-page-core.js` — feature extraction / ranking helpers.
- `hh-list-intelligence.js` — Batch Analysis, filters, queue, Fit/Calls UI and feedback.
- `duplicate-detector.js` — cross-ID repost advisory.

### Learning and model runtime

- `learning-core.js` — LearningEvent normalization, preference signals and dataset creation.
- `model-runtime.js` — compatible feature hashing, calibrated probability and bounded Fit blend.
- `model-monitor.js` — post-prediction metrics, calibration/drift summary and retraining proposal.
- `semantic-index.js` — deterministic local semantic hash-vector retrieval.
- `learning.html/js` — Learning & Model Center, datasets, registry import/promotion/disable.

### Applications/questionnaires

- `questionnaire-core.js` — form semantics.
- `questionnaire-memory.js` — exact + semantic confirmed-answer retrieval.
- `questionnaire-answer-engine.js` — evidence-first answers and safe fallbacks.
- `questionnaire-content.js` — DOM autofill plus trusted user-correction capture.
- `pre-submit-diff.js` — proposed field-change summary.
- `final-review-popup.js` — review gate and diff rendering.

### Recruiter/interview

- `recruiter-intelligence.js` — message intent and vacancy-grounded preparation.
- `interview-practice.js` — local answer-structure feedback.
- `interview.html/js` — interview-prep and mock-practice surface.

### Provider abstraction

- `site-adapter-core.js` — formal adapter contract.
- HH is the primary validated provider. Other providers must not be called live-supported until their adapters are verified against their current sites.

## ML tools

`tools/ml/` contains the offline lifecycle:

- dataset validation;
- preference and employer-engagement logistic baselines;
- train/calibration/test splitting;
- threshold and temperature calibration;
- held-out evaluation;
- model registry;
- explicit promotion gate;
- prediction monitoring and retraining recommendation.

The browser does not execute Python training.

## Trust boundaries

Candidate facts come only from confirmed profile/CV memory or explicit user edits. Learning events can affect ranking preference and answer retrieval but cannot create new factual biography. High-risk legal/work-authorization fields remain review-gated.

## Safety separation

Calls and Sales exclusions are deterministic hard gates. A promoted ML model is a ranking signal, not authority to bypass those gates or submit an application silently.

## Storage

- vacancy/application/questionnaire state: local extension storage;
- learning events/model registry: local extension storage;
- exported datasets/model artifacts: user-selected local files;
- repository: source/tests/docs only.
