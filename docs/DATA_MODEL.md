# Data Model

This document describes the structured data foundation used by 4.0 and planned learning versions.

## CandidateProfile

Confirmed candidate facts, contacts, skills, projects and role evidence. Candidate facts remain the source of truth for writing/autofill.

## JobPreferenceProfile · active in 4.0

```json
{
  "schemaVersion": 1,
  "preferredRoles": [],
  "dislikedRoles": [],
  "avoidCalls": true,
  "avoidSales": true,
  "remotePreferred": true,
  "officeAllowed": true,
  "minimumFitScore": 80,
  "batchConcurrency": 3,
  "maxBatchPerPage": 80
}
```

## VacancyIntel · active in 4.0

Keyed by exact vacancy ID.

```json
{
  "schemaVersion": 1,
  "vacancy": {
    "vacancyId": "779",
    "url": "https://hh.ru/vacancy/779",
    "title": "...",
    "company": "..."
  },
  "analysis": {
    "status": "no-calls",
    "confidence": 0.98,
    "source": "hh-api"
  },
  "fit": {
    "score": 91,
    "decision": "STRONG_MATCH",
    "ready": true,
    "reasons": [],
    "risks": [],
    "algorithm": "rules-v1"
  },
  "features": {
    "role": "technical_support",
    "technologies": ["c#", "sql server"],
    "remote": true,
    "calls": "no-calls"
  },
  "at": 0
}
```

The full vacancy description is not duplicated into this ranking memory when a structured snapshot is sufficient.

## VacancyDecision · active in 4.0

```json
{
  "vacancyId": "779",
  "decision": "SAVED | SKIPPED | REVIEWED",
  "at": 0
}
```

## Application / Questionnaire

Existing application jobs continue to hold the prepared vacancy, CV/cover-letter context, timeline, form memory and questionnaire state.

## LearningEvent · planned 4.1

```json
{
  "eventId": "...",
  "timestamp": 0,
  "eventType": "VACANCY_SKIPPED",
  "vacancyId": "779",
  "input": {},
  "modelDecision": {},
  "userAction": {},
  "originalValue": null,
  "correctedValue": null,
  "confidence": null
}
```

4.0 queue decisions are deliberately kept simple so 4.1 can migrate/emit them into this event model without pretending learning already exists.

## ApplicationOutcome · planned 4.2

Lifecycle labels will include Applied, Viewed, Recruiter Replied, Interview, Test Assignment, Rejected, No Response and Offer.

## ModelVersion · planned 5.0

A trained model record must include model version, dataset version, training date, feature schema, metrics, thresholds and artifact hash.
