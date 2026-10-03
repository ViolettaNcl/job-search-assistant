# Implementation Status · 4.0.0

## Current milestone

4.0.0 introduces the first structured ranking layer on top of the stable 3.9.x HH workflow. The primary additions are Batch Analysis, explainable Fit Score, search-page filters, a user-controlled Ready to Apply queue and persistent Job Preference/decision memory.

4.0.0 intentionally uses deterministic rules (`rules-v1`). It does not claim trained ML. Its structured outputs are the data foundation for 4.1 learning.

## Feature matrix

| Capability | Status | Notes |
|---|---|---|
| Exact HH search-card detection | Ready | vacancy-ID isolation |
| Single-card `Analysis` | Ready | Full DOM + HH API fallback |
| Phone-duty detection | Ready | Distinguishes duties from telephony configuration |
| **Batch Analysis** | Ready | Current rendered page, bounded concurrency |
| **Structured vacancy features** | Ready | Role, technologies, remote, calls, sales, seniority, years requirement |
| **Explainable Fit Score** | Ready | `rules-v1`, reasons + risks |
| **Job Preference Profile** | Ready | Threshold, calls, remote, office, sales, batch concurrency |
| **Search-page filters** | Ready | All / no calls / fit / ready / saved |
| **Ready to Apply queue** | Ready | Apply / Show / Save / Skip; user-controlled |
| Vacancy decision memory | Ready | Saved / skipped / reviewed |
| `✦ Отклик + письмо` | Ready | Vacancy-specific writing |
| Employer-already-viewed guard | Ready | Known terminal modal only |
| Persistent vacancy/application memory | Ready | Back/reload/repeated-card restoration |
| Smart Questionnaire Autofill | Ready | Semantic field classification |
| Human fallback drafts | Ready | Reviewable subjective free-text only |
| Questionnaire answer memory | Ready | Confirmed reusable answers |
| Recruiter-chat draft | Ready | No automatic Send |
| Optional dashboard/backend | Advanced | Local backend |
| 4.1 Learning Event Store | Planned | Not active in 4.0 |
| Trained preference model | Planned 5.0 | Requires labelled data first |

## 4.0 storage additions

- `vjaJobPreferencesV1`
- `vjaVacancyIntel:<vacancyId>`
- `vjaVacancyDecision:<vacancyId>`

Existing 3.9.x application/questionnaire/call-analysis memory is preserved.

## Intentional safety boundaries

Batch Analysis never mass-submits applications. The queue only exposes explicit user actions. Fit Score is advisory and explainable; a low/high score does not alter the underlying HH vacancy.

The assistant still stops when the full vacancy cannot be verified, the vacancy identity becomes ambiguous, a required questionnaire answer needs an unknown factual/legal value, or DOM write verification fails.

## Known limitations

- HH production DOM can change independently of this project.
- Batch Analysis can be throttled or delayed by HH/API behaviour; concurrency is intentionally bounded.
- `rules-v1` is a deterministic baseline, not a trained personalization model.
- Current-page filters apply to rendered cards, not unseen pages of HH results.
- CAPTCHA/MFA and some cross-origin forms can still require manual action.
