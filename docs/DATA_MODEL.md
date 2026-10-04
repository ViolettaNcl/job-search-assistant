# Data Model · 5.2

## Vacancy

`provider`, `vacancyId`, `url`, `title`, `company`, full text and structured features.

## VacancyIntelligence

Calls status/evidence, deterministic Fit, personal adjustment, optional preference-ML output, optional separate engagement-ML output, reasons/risks and timestamps.

## Application

Vacancy identity, CV/cover letter, questionnaire state, timeline and current outcome.

## LearningEvent

Event ID/time, vacancy context/features, decision context, optional ML prediction, user action, optional original/corrected text, source/confidence and outcome metadata.

## Preference dataset row

One latest preference label per vacancy plus structured features. Target: `labelUserApply`.

## Engagement dataset row

Derived from outcome events. Target: `labelEmployerEngagement`. Independent from preference.

## Model Registry v2

```text
models[]
activeModels.preference
activeModels.engagement
updatedAt
```

Each entry stores version/type/status, SHA-256, threshold/calibration and evaluation/training metadata.

## Storage

Runtime data is local by default (`chrome.storage.local` / session where appropriate). Git stores source, schemas and tests, not user runtime databases.
