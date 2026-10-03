# Personal Learning System · planned 4.1

## Goal

The learning layer should adapt to the user's confirmed decisions and corrections without silently rewriting Candidate Truth or claiming that a rules engine is a trained model.

## Training signals

Strong signals:

- user clicks Apply after reviewing a vacancy;
- user explicitly Skips;
- user edits an AI questionnaire answer;
- user edits a cover letter/recruiter reply;
- user confirms a preference such as salary strategy;
- user overrides a Fit recommendation.

Weak/implicit signals should be stored separately from explicit corrections.

## Memory separation

- **Fact Memory** — confirmed biographical/professional facts.
- **Preference Memory** — job-search preferences.
- **Answer Memory** — confirmed reusable questionnaire answers.
- **Writing Memory** — AI draft → user-edited pairs.
- **Vacancy Memory** — analysis/features/ranking history.
- **Outcome Memory** — application results.

A preference or writing correction must never automatically become a Candidate Fact.

## 4.1 implementation sequence

1. Introduce a versioned `LearningEvent` schema.
2. Emit events from existing Apply/Save/Skip/Edit flows.
3. Add export/reset controls.
4. Build retrieval of similar confirmed corrections.
5. Use retrieved examples for future drafts/ranking explanations.
6. Add summary statistics only after enough events exist.

No fine-tuning is required for 4.1.

## Active learning preparation

Every future classifier should expose a confidence value. High-confidence predictions can be automated only where safe; medium confidence should be reviewable; low confidence should request user input.
