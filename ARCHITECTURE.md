# Architecture · Violetta Apply Assistant 4.0

## Design principles

- **Vacancy-first:** every search-card action is pinned to an exact vacancy identity.
- **Extension-first:** core workflow does not require the local backend.
- **Evidence-first:** candidate facts and vacancy data are verified before writing or autofill.
- **Explainable ranking:** 4.0 Fit Score is deterministic `rules-v1` with visible reasons/risks.
- **Persistent state:** HH SPA navigation must not erase analysis/application/form state.
- **Fail-safe automation:** uncertain irreversible actions remain user-controlled.
- **Data-first ML roadmap:** 4.0 records structured features/decisions; training is deferred until enough labels exist.

## Main components

### Search-card layer

`hh-list-quick-apply-core.js`
: exact HH identifiers, phone-duty Analysis rules and safe action matching.

`hh-list-quick-apply.js`
: per-card Analysis and `✦ Отклик + письмо` UI, status restoration and application flow.

`vacancy-fit.js`
: pure deterministic vacancy feature/fit scorer. It has no network/storage dependencies and exposes `rules-v1` score explanations.

`job-search-page-core.js`
: pure helpers for page-level de-duplication, filters, progress and badge labels.

`hh-list-intelligence.js`
: Batch Analysis toolbar, bounded worker queue, Fit badges, current-page filters, Ready to Apply queue and explicit Save/Skip/Review actions.

### Service worker intelligence

`copilot-background.js` coordinates:

- exact full-vacancy acquisition;
- HH hidden DOM + API race/fallback;
- phone-duty Analysis;
- `vjaRelevance.analyze` structured extraction;
- candidate profile lookup;
- Fit Score calculation;
- vacancy intelligence persistence;
- preference/decision memory;
- application preparation.

Multiple requests for the same vacancy are de-duplicated with an in-flight map.

### Questionnaire layer

`questionnaire-core.js`
: question/field recognition and semantic categories.

`questionnaire-answer-engine.js`
: evidence-grounded answers plus reviewable human fallback drafts.

`questionnaire-memory.js`
: reusable confirmed answers and per-vacancy form state.

`questionnaire-content.js`
: DOM fill/verification, MutationObserver and review UI.

### Candidate/evidence layer

`candidate-truth.js`, `candidate-seed.js`, `relevance-engine.js`
: confirmed facts, role routing, vacancy evidence selection and writing validation.

## 4.0 Batch Analysis flow

```text
HH search page
  ↓
hh-list-intelligence.js collects unique visible vacancyIds
  ↓
3 workers by default (configurable 1–4)
  ↓
quick-list-full-analysis
  ↓
cpAcquireHhVacancy
  ├─ hidden DOM reader
  └─ api.hh.ru fallback/race
  ↓
phone-duty Analysis
  ↓
vjaRelevance.analyze(full vacancy)
  ↓
vacancy-fit.js + Candidate Truth + Job Preference Profile
  ↓
Fit Score + reasons + risks + feature snapshot
  ↓
vjaVacancyIntel:<vacancyId>
  ↓
Fit badge / filters / Ready Queue
```

No step in this flow submits an application.

## 4.0 storage model

### `vjaJobPreferencesV1`

```json
{
  "preferredRoles": ["technical_support", "developer"],
  "dislikedRoles": ["sales"],
  "avoidCalls": true,
  "avoidSales": true,
  "remotePreferred": true,
  "officeAllowed": true,
  "minimumFitScore": 80,
  "batchConcurrency": 3,
  "maxBatchPerPage": 80
}
```

### `vjaVacancyIntel:<vacancyId>`

Stores only the structured snapshot needed for ranking/memory:

```json
{
  "schemaVersion": 1,
  "vacancy": {"vacancyId": "...", "title": "...", "company": "...", "url": "..."},
  "analysis": {"status": "no-calls", "confidence": 0.98, "source": "hh-api"},
  "fit": {"score": 91, "decision": "STRONG_MATCH", "reasons": [], "risks": [], "algorithm": "rules-v1"},
  "features": {"role": "technical_support", "technologies": [], "remote": true},
  "preferenceKey": "...",
  "at": 0
}
```

A changed preference profile invalidates the cached Fit Score while allowing the vacancy to be re-evaluated.

### `vjaVacancyDecision:<vacancyId>`

Explicit 4.0 user queue state: `SAVED`, `SKIPPED` or `REVIEWED`.

These decisions are not yet ML training events. 4.1 will migrate/emit them into a dedicated Learning Event model.

## Fit Score rules-v1

The baseline starts at a neutral score and applies bounded adjustments for role preference, calls, sales, remote/office format, skill overlap, seniority, explicit experience years and English requirement.

Important hard constraints:

- when `avoidCalls=true`, a confirmed calls vacancy is capped at a low score and cannot enter Ready Queue;
- when `avoidSales=true`, sales-focused vacancies are capped and not ready;
- the score contains the algorithm ID and explanation arrays.

This is deliberately not described as ML.

## Optional backend

The .NET backend remains the advanced runtime for dashboard/server automation/analytics. 4.0 extension ranking does not depend on it. Source release metadata can be updated during publication without replacing the backend runtime in a source-only commit.

## Future learning boundary

4.1 will add a versioned Learning Event Store. 5.0 may train models only from labelled user/outcome data and must keep evaluation/test data separate from training data. See `docs/LEARNING_SYSTEM.md` and `docs/ML_ARCHITECTURE.md`.
