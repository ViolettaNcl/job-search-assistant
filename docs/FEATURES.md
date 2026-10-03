# Feature Reference · 4.0

## HH search page

| Feature | Status | Behaviour |
|---|---|---|
| Exact-card detection | Ready | Uses exact `vacancyId` |
| Single-card Analysis | Ready | Full DOM + HH API fallback |
| Batch Analysis | Ready | Current rendered page, bounded concurrency |
| Call-duty classification | Ready | Calls / no-calls / unknown |
| Structured feature extraction | Ready | Role, tech, remote, calls, sales, seniority, experience |
| Explainable Fit Score | Ready | Deterministic `rules-v1` |
| Job Preference Profile | Ready | Local, editable search preferences |
| Search filters | Ready | All / no calls / fit / ready / saved |
| Ready to Apply queue | Ready | User-controlled actions |
| Save / Skip decision memory | Ready | Per vacancy ID |
| Quick apply + cover letter | Ready | Exact vacancy only |

## Application forms

| Feature | Status |
|---|---|
| Persistent application context | Ready |
| Questionnaire semantic classification | Ready |
| Confirmed answer autofill | Ready |
| Human fallback drafts | Ready / reviewable |
| DOM write verification | Ready |
| Dynamic/multi-step forms | Ready |
| Final submit safety gate | Ready |

## Recruiter workflow

| Feature | Status |
|---|---|
| Recruiter chat context | Ready |
| AI draft insertion | Ready |
| Automatic Send | Disabled by design |
| Follow-up memory | Available |

## Advanced backend

Local dashboard, advanced Autopilot and server analytics remain available when the backend is running. The new 4.0 search-page ranking/queue does not require it.

## Planned intelligence

- 4.1: Learning Event Store and personalization from accepted/edited/skipped decisions.
- 4.2: outcome analytics and application lifecycle learning.
- 4.3: recruiter/interview intelligence.
- 4.4: multi-site adapters and duplicate/repost detection.
- 5.0: trained ML models after sufficient real labelled data exists.
