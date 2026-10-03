# Data Model · 5.0

## Core entities

### Vacancy

`provider`, `vacancyId`, `url`, `title`, `company`, `description`, `requirements`, structured features.

### VacancyIntelligence

Calls analysis, Fit Score, personal-learning adjustment, duplicate/repost advisory and timestamp/source.

### Application

Vacancy reference, CV/cover-letter state, questionnaire memory, timeline, current outcome/status.

### LearningEvent

User decision or correction with the decision context and structured vacancy features.

### PreferenceSignals

Derived local weights used by the explainable personalization layer.

### ApplicationOutcome

Applied/viewed/reply/interview/test/offer/rejection state; kept conceptually separate from preference labels.

### ModelRegistry

Versioned candidate/active model metadata, evaluation metrics, SHA-256 and promotion status.

## Storage

Extension state remains local by default (`chrome.storage.local` / session where appropriate). The Git repository stores code/schemas, not runtime databases.
