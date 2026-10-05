# Architecture · 6.0.0 RC2

## Application path

```text
Job-site DOM / provider API
  ↓
Site adapter + exact vacancy identity
  ↓
Full vacancy reader
  ↓
Deterministic safety analysis + structured features
  ↓
Rules Fit + bounded personal signals + optional promoted preference model
  ↓
Queue / Apply preparation
  ↓
Direct apply OR dedicated questionnaire page
  ↓
Questionnaire classifier + confirmed memory + reviewable fallback drafts
  ↓
✦ Fill + pre-submit diff
  ↓
USER-CONTROLLED FINAL SUBMIT
  ↓
Outcome / Learning events
```

RC2 specifically recognizes dedicated HH questionnaire pages even when they do not expose a conventional `<form>` element.

## Learning/model path

```text
real user decisions
→ LearningEvents
→ de-duplicated preference dataset
→ local browser trainer OR offline Python trainer
→ chronological train/calibration/test
→ held-out metrics
→ candidate Model Registry entry
→ Shadow Mode / explicit promotion
→ bounded runtime inference
→ later monitoring and retraining proposal
```

Preference and employer-engagement targets remain separate. Hard safety/preferences such as Calls/Sales gates are not overridden by ML.

## Migration and release trust

`product-migrations.js` applies additive schema patches for older local state. Release publication is allowlisted and hash-checked; optional Git tag signing uses only the user's configured signing key.

## Provider abstraction

HH is primary. Habr Career is RC2 beta. New providers must implement the formal adapter contract and pass current live-flow validation before being called supported.
