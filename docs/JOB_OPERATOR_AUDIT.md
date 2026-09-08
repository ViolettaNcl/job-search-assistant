# Job Operator first execution pass — 2026-09-08

Inspected main: `157ba6aece05c0f4fd2c2c45e0c293586d267880`, tree `0ed885bff8d4212e9ba4b01f4ce294a4106ca261`.
No open PRs. #51, #52 and #53 merged. Main CI and Windows package run 34248245350 succeeded.
Extension 2.6.5. No published GitHub Releases; bundles are expiring Actions artifacts.
Branch: `feat/job-operator-intelligence-core`, based on current main.

| Disposition | Findings |
| --- | --- |
| KEEP | .NET 10, EF SQLite/PostgreSQL, baseline migration/bootstrap, application unique index, CRM events, HH OAuth/status sync, CV vault, submission verification, Windows self-contained build/restart checks |
| REFACTOR | Candidate truth/identity, requirement assessment, evidence selection, hardcoded remote filters, local settings precedence |
| REPLACE | Keyword sum as compatibility percentage; template-first project selection |
| REMOVE | Public phone default, unverified patronymic default, implicit EU residence assumption |
| MISSING | CodeQL, calibrated outcomes, full recruiter message ingestion, proven browser pilot reliability, configurable semantic provider, measured career-lane quotas |

Baseline: all 24 JS suites ran locally successfully before changes; .NET SDK absent locally and SDK download timed out. Exact baseline main .NET/SQLite CI is green; new .NET changes must pass remote CI before merge. No local AGENTS.md found.

Production: Vercel container config exists, no Railway configuration found. No deployment changes authorized or performed. Remote private deployment runtime/access has not been verified. APIs expose local candidate/automation state without an authentication boundary; public deployment is not production-ready for private operator data.

Portfolio sources were read at pinned commits in CandidateKnowledgeService. DentalClinic now targets .NET 10 (old README mentioned .NET 9); FleetManagement uses .NET Framework 4.7.2/EF6, not EF Core; Smart Route Planner's ML is implemented in PHP, not proof of Python or paid ML employment. CV explicitly confirms the three localized names. Repository code establishes implementation evidence, not paid employment or sole authorship.

Known pilot risks: no authenticated HH end-to-end sample measured here; prior unit-test results did not prove extension stability. Timeout wrappers do not cancel an employer submission or guarantee a result. Popup MutationObserver callbacks and shared manual/autopilot pending state still require browser-level pilot validation. Do not present unit tests as a measured submission success rate.

Privacy: phone removed from current public defaults. Existing Git history still contains the earlier value; no history rewrite is performed. Existing SQLite data, Chrome memory, environment variables and user-settings.cmd are preserved. Private overrides can live in `%LOCALAPPDATA%/ViolettaApplyAssistant/candidate.private.json` (Candidate section), or Candidate__Phone. This file inherits OS access permissions; credentials belong in environment/established secret storage. No paid AI calls or real job applications are made during CI.
