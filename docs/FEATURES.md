# Feature Reference · 5.2

## Search and ranking

| Feature | Status | Notes |
|---|---|---|
| Exact HH vacancy identity | Ready | Uses exact `vacancyId` |
| Full vacancy reader | Ready | DOM + hidden-tab retry + HH API fallback |
| Single Analysis | Ready | Calls / no-calls / unknown |
| Batch Analysis | Ready | Bounded concurrency |
| Explainable rules Fit | Ready | Always available |
| Personal signal adjustment | Ready | Bounded from real feedback |
| Promoted preference ML | Ready when model promoted | Bounded contribution only |
| Engagement ML | Ready when model promoted | Separate signal; not Fit |
| Filters / Ready Queue | Ready | User-controlled |
| Duplicate/repost advisory | Ready | Cross-ID similarity |

## Applications and forms

| Feature | Status |
|---|---|
| Vacancy-specific cover letter | Ready |
| Persistent application context | Ready |
| Questionnaire classification/autofill | Ready |
| Human fallback drafts | Ready / reviewable |
| Exact confirmed-answer memory | Ready |
| Semantic confirmed-answer retrieval | Ready; deterministic local vector index |
| User correction learning | Ready |
| Pre-submit diff | Ready |
| Final submit safety gate | Ready |

## Learning / ML

| Feature | Status |
|---|---|
| LearningEvent store | Ready |
| Explicit/implicit preference labels | Ready |
| Preference dataset export | Ready |
| Engagement dataset export | Ready |
| Offline preference model | Ready |
| Offline engagement model | Ready |
| Calibration / threshold tuning | Ready |
| Model Registry v2 | Ready |
| Import / explicit promotion / disable | Ready |
| Runtime inference | Ready after promotion |
| Prediction monitoring / drift | Ready after enough post-prediction labels |
| Retraining proposal | Ready; advisory only |
| Silent online retraining | Not implemented by design |

## Recruiter / interview

| Feature | Status |
|---|---|
| Recruiter chat context | Ready |
| Intent classification | Ready |
| Suggested replies | Ready; Send remains user-controlled |
| Interview prep | Ready |
| Mock-answer structure feedback | Ready |

## Providers

HH is the primary validated provider. The adapter contract exists for additional providers, but no site is labelled fully supported until its current live flow is validated.
