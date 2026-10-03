# Implementation Status · 5.0.0 Foundation

## Production-ready extension paths

- HH exact vacancy Analysis.
- Calls / no-calls classification with full-vacancy verification.
- Batch Analysis with bounded concurrency.
- Explainable rules-v1 Fit Score.
- Bounded personal-learning adjustment from real decisions.
- Explicit Fit vs Calls UI.
- Ready Queue / Save / Skip / Apply.
- Persistent vacancy/application/questionnaire memory.
- Vacancy-specific cover letters.
- Questionnaire autofill + human fallback + review gate.
- Employer-already-viewed recovery.
- Recruiter chat foundation and application timeline.
- Learning Center and local learning export/import/reset.

## Foundation / offline-ready

- Cross-ID duplicate/repost similarity.
- Recruiter intent classifier and interview plan generator.
- Multi-site adapter contract.
- Logistic preference training/evaluation pipeline.
- Model registry and promotion gate.

## Not claimed as production ML yet

No trained personal ML model is bundled as active by default. The user must first accumulate real labelled decisions, export them, train/evaluate a candidate and pass promotion. Until then Fit uses deterministic rules + personal event-derived signals.

## Live-site scope

HH is the primary site tested against the project's live workflow. Other site selector profiles are not equivalent to full verified adapters.
