# Implementation Status · 3.9.13

## Current release

3.9.13 сохраняет пользовательское поведение 3.9.12 и обновляет документацию/repository hygiene. Основной runtime — Chrome extension; backend остаётся optional advanced mode.

## Feature matrix

| Capability | Status | Notes |
|---|---|---|
| HH search-card detection | Ready | Exact-card / vacancy-ID isolation |
| `Analysis` | Ready | Full DOM + HH API fallback |
| Phone-duty detection | Ready | Distinguishes call duties from telephony configuration |
| `✦ Отклик + письмо` | Ready | Vacancy-specific writing |
| Employer already viewed guard | Ready | Known terminal modal only |
| Persistent vacancy memory | Ready | Back/reload/repeated-card restoration |
| Smart Questionnaire Autofill | Ready | Semantic field classification |
| Human fallback drafts | Ready | Reviewable free-text drafts only |
| Questionnaire answer memory | Ready | Confirmed reusable answers |
| DOM write verification | Ready | Re-read after input/change/blur |
| Dynamic/multi-step questionnaire handling | Ready | MutationObserver + debounce |
| Recruiter chat draft | Ready | No automatic Send |
| Local CV selection | Ready | Bundled candidate CVs |
| External AI provider | Optional | Configured from extension settings |
| Dashboard | Advanced | Requires local backend |
| Browser Autopilot queue | Advanced | Requires local backend |
| Server analytics/follow-up | Advanced | Requires local backend |

## Safety / intentional stops

The assistant intentionally stops or requests review when:

- the full vacancy cannot be verified;
- the selected card/vacancy ID becomes ambiguous;
- an HH modal/action is not uniquely identified;
- a required questionnaire answer depends on an unknown verifiable fact;
- a legal/work-authorization/consent answer is not confirmed;
- DOM write verification fails.

## Repository state expected after publication

Expected tracked source directories:

```text
.github/
browser-extension/
docs/
scripts/
src/
tests/
tools/
```

The repository should not track FULL bundle folders, runtime binaries, local databases or test output.

## Known limitations

- Production HH DOM can change independently of this project.
- CAPTCHA/MFA may require manual interaction.
- Some cross-origin employer forms may not be writable without explicit Chrome permission.
- Human fallback drafts require review and are not verified candidate facts.
- Automated writing does not guarantee employer response or ATS success.
