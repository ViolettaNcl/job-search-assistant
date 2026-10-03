# Architecture · 5.0.0 Foundation

## Runtime layers

```text
HH / job-site DOM
  ↓
Site adapter / exact vacancy identity
  ↓
Vacancy Reader (DOM + API fallback)
  ↓
Rules: calls + structured features
  ↓
Base Fit Score
  ↓
Personal Learning Signals (bounded)
  ↓
Search UI / Queue / Apply
  ↓
Application / Questionnaire / Recruiter workflow
  ↓
Outcome + Learning Events
  ↓
Learning Center / Dataset Export
  ↓
Offline ML Training → Evaluation → Registry → Promotion
```

## Key modules

- `hh-list-intelligence.js` — Batch Analysis, Fit/Calls UI, queue and feedback.
- `vacancy-fit.js` — deterministic base scoring.
- `learning-core.js` — event normalization, derived personal signals, bounded score adjustment, dataset rows.
- `duplicate-detector.js` — cross-ID repost similarity.
- `outcome-analytics-v2.js` — preference-independent outcome funnel.
- `recruiter-intelligence.js` — deterministic recruiter intent and interview prep.
- `site-adapter-core.js` — future provider contract.
- `learning.html/js` — local Learning Center.
- `tools/ml/*` — offline ML lifecycle.

## Trust boundaries

Candidate facts come from confirmed profile/CV memory. Learning events may change ranking preference, but they cannot create new biographical facts. High-risk questionnaire categories remain review-gated.

## Model lifecycle

Production model activation is intentionally separate from event collection. Model artifacts are versioned files, evaluated offline and promoted through an explicit gate. Extension operation does not depend on a model being present.
