# Roadmap

The project follows a data-first sequence. Each milestone should create reliable inputs for the next rather than adding "AI" labels without evidence.

## 4.0 — Batch Analysis + Explainable Ranking · Current

- Batch Analysis of current HH search results.
- Structured vacancy feature extraction.
- Explainable Fit Score (`rules-v1`).
- Job Preference Profile.
- Ready to Apply queue.
- Search-page filters.
- Save / Skip / Review decision memory.

Exit criterion: the 4.0 workflow is stable on real HH usage and produces trustworthy structured vacancy/decision data.

## 4.1 — Personal Learning Engine

- `LearningEvent` store for accepted, skipped, edited and corrected decisions.
- Explicit feedback: Good / Edit / Wrong where useful.
- Implicit feedback signals from Apply / Skip / Save.
- Separation of Fact, Preference, Answer, Writing, Vacancy and Outcome memory.
- Retrieval of similar user-confirmed questionnaire/writing corrections.
- No trained model required yet: retrieval + structured statistics first.

## 4.2 — Outcome Learning + Analytics

- Full application lifecycle: Applied → Viewed → Reply → Interview → Test → Offer / Rejection / No response.
- Application timeline linked to CV, cover letter and questionnaire answers.
- Conversion metrics with sample-size reporting.
- Separate targets for user preference and employer engagement.
- Outcome-aware ranking signals, without claiming causality from small samples.

## 4.3 — Recruiter Intelligence + Interview Copilot

- Recruiter message intent classification.
- Vacancy/CV/letter-aware reply suggestions.
- Short / Normal / Detailed drafts.
- Interview preparation and mock interview mode.
- Structured feedback on clarity, factual accuracy and relevance.

## 4.4 — Multi-site Job Agent

- `JobSiteAdapter` abstraction.
- Additional supported job sites behind separate adapters.
- Cross-site canonical vacancy fingerprint.
- Duplicate/repost detection, optionally using embeddings.

## 5.0 — Real Machine Learning

Only after enough real labelled data exists:

- Personal Vacancy Preference Classifier: `P(user_would_apply | vacancy)`.
- Employer Engagement ranking signal: `P(reply | application)`.
- Optional call-duty and questionnaire classifiers from corrected labels.
- Active learning based on confidence thresholds.
- Model registry, dataset versions, offline evaluation and promotion gates.

Initial baselines should be interpretable (for example Logistic Regression) before evaluating more complex models. Neural networks are not a project goal by themselves.
