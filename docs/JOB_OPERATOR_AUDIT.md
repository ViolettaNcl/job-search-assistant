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
| MISSING | Calibrated outcomes, full recruiter message ingestion, proven browser pilot reliability, measured career-lane quotas |

Baseline: all 24 JS suites ran locally successfully before changes; .NET SDK absent locally and SDK download timed out. Exact baseline main .NET/SQLite CI is green; new .NET changes must pass remote CI before merge. No local AGENTS.md found.

Production: Vercel container config exists, no Railway configuration found. No deployment changes authorized or performed. Remote private deployment runtime/access has not been verified. APIs expose local candidate/automation state without an authentication boundary; public deployment is not production-ready for private operator data.

Portfolio sources were read at pinned commits in CandidateKnowledgeService. DentalClinic now targets .NET 10 (old README mentioned .NET 9); FleetManagement uses .NET Framework 4.7.2/EF6, not EF Core; Smart Route Planner's ML is implemented in PHP, not proof of Python or paid ML employment. CV explicitly confirms the three localized names. Repository code establishes implementation evidence, not paid employment or sole authorship.

Known pilot risks: no authenticated HH end-to-end sample measured here; prior unit-test results did not prove extension stability. Timeout wrappers do not cancel an employer submission or guarantee a result. Popup MutationObserver callbacks and shared manual/autopilot pending state still require browser-level pilot validation. Do not present unit tests as a measured submission success rate.

Privacy: phone removed from current public defaults. Existing Git history still contains the earlier value; no history rewrite is performed. Existing SQLite data, Chrome memory, environment variables and user-settings.cmd are preserved. Private overrides can live in `%LOCALAPPDATA%/ViolettaApplyAssistant/candidate.private.json` (Candidate section), or Candidate__Phone. This file inherits OS access permissions; credentials belong in environment/established secret storage. No paid AI calls or real job applications are made during CI.

## Implemented milestone 2.7.0 (PR #54)

- Canonical candidate knowledge with four revision-pinned projects and skill evidence. Unknown employment/availability/salary/relocation remains unknown. Local identity conflicts create review reasons.
- Requirement-family normalization and explained, explicitly uncalibrated opportunity index. Required experience, unknown residence eligibility, mandatory degree and missing language evidence stop automatic qualification. Remote is preferred; explicit remote-only is honored.
- Fresh qualification in production queues and HH API submission gates; legacy stored scores cannot authorize submission. All candidates are assessed before queue limit (no hidden 300-row starvation).
- Evidence-first short project drafts. Optional HTTPS chat-completions-compatible provider; model/key/endpoint from configuration. AI text remains review-only, invalid/unavailable output falls back. No live paid calls in tests.
- Existing dashboard now leads with attention items, offers a vacancy explanation and project links, and a manual recruiter-message triage tool. No new competing frontend.
- Recruiter intent/urgency/high-risk routing is deterministic fallback. No automatic recruiter replies and no claim that HH update flags contain message text.
- Learning minimum is 20 per segment; rejections do not count as positive responses in priority learning. This remains descriptive smoothing, not a trained or calibrated predictive model.
- Popup observer settles after one class mutation. Timeout recovery does not authorize retries after uncertain employer submission.
- Existing-response API errors no longer record an unsent new cover letter as delivered.
- CodeQL workflow added; extension/backend version 2.7.0. New operator routes included in SQLite restart and Windows EXE HTTP smoke verification.

## Configuration and data preservation

Set `Reasoning__Enabled=true`, `Reasoning__Endpoint` to the complete HTTPS chat-completions endpoint, `Reasoning__Model`, and `Reasoning__ApiKey` in local environment to enable optional suggestions. Off by default. Provider receives vacancy text and selected public project evidence only. Explicit local preparation requests may incur provider charges; dashboard listing does not invoke it. Configured provider needs independent quality evaluation before any unattended use. Redirects are disabled; responses/time bounded. Suggestions cannot authorize automatic application or alter canonical candidate facts.

Private JSON and local settings are excluded from Git, Docker context and .NET publish. Existing user values are not deleted or silently renamed. Conflicting private identity overrides require review. Public Git history is not rewritten. The existing public CV email is intentionally retained; phone defaults are empty. The additional AI preparation endpoint is restricted to loopback with localhost Host; public deployments still require an application-wide authentication design before private inbox persistence.

## Remaining production gates

1. Real authenticated HH pilot: **0 attempts performed in this pass**, success/duplicate/timeout rates **unknown**. Unit fixtures and CI are not pilot applications. Capture attempted/succeeded/failed/review/deferred with distinct resume/letter confirmation and unknown-after-timeout states before asserting reliability.
2. Browser manual and autopilot session collision/recovery and the real post-response letter UI need an authenticated browser pilot. The observer regression is simulated and does not prove all hangs are fixed.
3. Full HH recruiter-message ingestion, persistent private inbox, reviewed send, deadlines/calendar conflict handling remain missing. Current triage is stateless pasted-message analysis with no transmission.
4. AI assists employer-need/letter suggestions only. Structured vacancy qualification still uses an explicit deterministic fallback; it has a finite skill/language catalog and incomplete salary/employment/domain extraction. It is not a semantic hiring model. Expand with validated provider fixtures and conservative unknown handling before replacing qualification.
5. Outcome feature snapshots at submission time (selected project, angle, friction, freshness, CV, technology, employer) and mature-cohort conversion analysis are still missing. Existing historical status snapshots cannot prove causality or reconstruct every funnel transition. No 2.3× claims from small samples.
6. Career lane shares are strategy metadata (70/20/10), not enforced scheduling quotas. Explicit accepted relocation requires a complete eligibility workflow; no relocation is inferred here.
7. Long-term release retention and signed Windows distribution are not implemented; current workflow supplies verified Actions ZIP artifacts.
8. No additional job platform work; HH reliability comes first. No LinkedIn or Vercel deployment added.

Official protocol references: [Chat Completions API](https://developers.openai.com/api/reference/resources/chat) and [CodeQL workflow configuration](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options).

## Follow-up 2.7.1 — autopilot settings and floating execution panel

Root causes addressed: server/UI clamped thresholds to 75; dashboard polling overwrote unsaved input; qualification used a separate fixed 75 gate; background collection awaited an HTTP request with a 15-second extension timeout; HH search failures were swallowed. Threshold is now configurable 50–100 and daily quota 1–200. Lower scores do not bypass missing mandatory evidence, seniority or eligibility review. CollectionCoordinator owns one coalesced collection job independently of the requesting browser, exposes errors/results, and starts the existing apply cycle afterward. An empty queue is shown as waiting, not active submission. HH API blocks/timeouts still require a working source connection; zero opportunities cannot produce applications.

HH vacancy pages automatically mount a movable, collapsible translucent panel containing the existing popup UI. Other ordinary websites can toggle the same panel via the popup. LinkedIn is excluded. Position persists; actions bind to the containing tab, not whichever tab is active later. Added isolated Chromium integration validation with synthetic local pages; no employer submissions occur in these tests. Real HH account and live post-response letter verification remain pilot gates.


## Follow-up 2.7.2 — evidence-based screening preparation

Inspected main `8099c9721881aa07f809cd8c5d827a99506e5f3b`; no active PRs. Branch `feat/screening-evidence-review` preserves the 2.7.1 collection/panel fixes. Existing 98 .NET tests and 25 JS suites were green on this exact base.

New ScreeningReviewService compares existing requirement assessments with verified project evidence and, optionally, the user's actual resume text. The extension displays matched evidence, unknown mandatory requirements, and a copyable plain-text project excerpt; it recommends adding only relevant verified terms missing from that text. Aliases normalize to skills, generic SQL does not stand in for SQL Server. Text mentions cannot establish paid employment or missing skills. A pasted resume cannot authorize an application. There is no new scoring percentage, fake ATS mode, hidden keywords or invented employer rejection reason. The report explicitly says the selected HH resume and file parsing are not inspected.

Private resume text stays in the loopback process with no persistence/provider calls. Added seven deterministic .NET tests, real Chromium text-injection/stale-result fixture checks, and endpoint checks in SQLite/Windows restart smoke. Real recruiter outcomes and actual rejection reasons remain unknown until supplied by the employer. No LinkedIn or Vercel changes.

References: [HH response filters](https://feedback.hh.ru/knowledge-base/article/1287), [Greenhouse resume parsing limitations](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse).

2.7.2 continuation: HH read errors now distinguish authorization, CAPTCHA, rate limits and unknown denial using documented error codes without displaying raw payloads. An existing broken OAuth connection no longer silently falls back to anonymous requests. Rocket control reuses saved backend settings. Opt-in browser discovery reads normal HH pages, stops at access challenges, observes pause/quota between pages and imports via the canonical HH vacancy ID. No claim that an unknown HTTP 403 can be removed locally; valid HH access remains required. Search is bounded to one configured query/ten pages per 30 minutes. Added HH read-error, browser-import identity and browser-discovery fixtures.


## Follow-up 2.7.3 — HH redirect recovery and contact footer

Inspected main `7f6597a22d6d4aeafe0b1d89dbf4b04865d1664e`, no active PRs. Branch `fix/hh-discovery-redirect-recovery`. The reported 2.7.2 stop comes from strict full-URL equality: a benign regional/tracking redirect became a persisted failure. Discovery now checks HH HTTPS host and task identity (same vacancy ID or search text and explicit filters), then verifies the returned document URL and current tab before import. Exact legacy generic-redirect stops retry with the corrected reader; real login/CAPTCHA/access stops remain. Dashboard duplicate error text is deduplicated.

Regression covers regional hosts, encoding, tracking parameters, trailing slash, wrong vacancy/query/host, missing filters, stale document response, legacy recovery, and CAPTCHA persistence. A Chromium fixture intercepts HH URLs, executes real redirects/content scripts and imports into a local mock API. It is not a live employer submission. New generated letters and short messages append the configured email once, including AI suggestions, using the email the user explicitly requested. Private local overrides are preserved.


## Follow-up 2.7.4 — discovery to application and an operational journal

Base main `fa7c1dde6bc549dd4220d7885d31a98281578e36`; branch `feat/autopilot-apply-flow`. Existing queued applications now take precedence over further collection. Each browser import triggers backend qualification and one controlled application, without waiting for the whole discovery batch. An unresolved receipt keeps its continuation plan and stops further discovery. Backend automatic queue filters verified eligibility/seniority before limiting results; manual review queues remain available. Review reasons are retained alongside compatible deferral timestamps.

The existing dashboard now leads with autopilot and application history, exposes discovery and submission dates independently, refreshes browser receipts even without a collector completion event, and preserves unsaved threshold edits. SQLite schema/data are retained. Added orchestration fixtures, queue-starvation regression, timestamp restart checks, and a Chromium dashboard fixture. These are synthetic verification, not a measured live HH submission pilot.


## 2.7.5 — remote-only qualification and actionable screening (2026-09-10)

Base main inspected: `ff7e80f1d1a4bfc42ac74fc9559517f44e1b69c6`; branch `fix/remote-only-autopilot`. No replacement application or deployment changes.

- Latest explicit user preference supersedes the earlier remote-preferred brief: remote-only default, plus unconditional remote checks before unattended queue selection/API submission. Existing history is preserved. A stale Eligible flag does not override onsite or mandatory-office evidence.
- Browser imports default missing remote metadata to false and normalize contradictions before storage/scoring. HH extraction does not fall back to the entire page when description markup is missing.
- Screening review returns prioritized actions for mandatory skill/experience/degree gaps, hiring eligibility, missing verified CV terms, and claims without repository evidence. Preferred gaps are not represented as mandatory. Reasons for actual rejection remain Unknown.
- README roadmap reconciled: existing immediate applications, email footer, provider/fallback and journal retained; obsolete LinkedIn setup removed. Actual HH pilot, live control validation and backup/restore drill remain explicitly open.
- Regression additions: remote defaults, legacy onsite/contradictory queue candidates before limit, import normalization, real extraction functions on DOM fixtures, truthful prioritized screening actions. Existing immediate-discovery/letter receipt, duplicate, timeout, SQLite and Windows gates retained.
- Live browser verification attempted 2026-09-10: HH returned “VPN мешает работе сайта” before vacancy content. No live application was sent and no production success rate is claimed. The code does not bypass that restriction.
- CI results are recorded in the release PR and checked on its latest head before merge.


## 2.7.6 — vacancy-specific writing review (2026-09-10)

Main inspected: `32de84262e55056e33947d4b61ac437f9b1925b7`; no active PRs at start. Branch: `fix/vacancy-specific-application-writing`.

Found and corrected: grounded writing discarded actual vacancy/company context, the independent headline classifier could disagree with strategy, and ranking two projects independently could omit complementary frontend evidence. Writing now retains bounded role/company labels, links the main project, includes a second project only for additional relevant verified skills, and uses the same strategy headline. Frontend-only roles no longer receive a Full-Stack .NET variant; QA retains QA positioning even when FleetManagement provides the best evidence.

All application claims remain project experience. Optional AI prose remains review-only. No promise of ATS bypass, hidden keywords, invented employment, new platform, or deployment. Remote-only gates and confirmed resume + letter receipts are unchanged. Regression coverage proves context retention, frontend/backend complementary evidence, redundant-project omission, accurate headlines and evidence-reference validation.

27 JavaScript suites passed locally. Full backend, browser, SQLite, CodeQL and Windows checks are recorded on the latest release PR head. Live HH submission remains unverified after the previous browser displayed the HH VPN restriction; fixture success is not a production success rate.


## 2.7.7 — junior experience bands and broader technical discovery (2026-09-10)

Base inspected: `3385d232014a3fa928d022f594b0eecbc6175463`; branch `fix/junior-autopilot-opportunities`.

The user explicitly accepts junior/intern opportunities carrying HH's 1–3-year category. That metadata band previously stopped otherwise qualified junior applications. It now permits a decision based on skills, location and requirements when the role is explicitly entry-level and no mandatory years are stated. Neutral-level jobs still need review. Required years and free-text experience unknowns are not waived or converted into employment claims. Russian/English band text is normalized in backend qualification, so imports and API records use the same policy.

Search defaults now interleave C#/.NET, frontend, WPF, PHP internships, QA automation, technical implementation and SQL/API support. Internship classification also recognizes verified non-.NET technologies. The browser execution layer remains generic: immediately after import, qualify → prepare the job's letter → apply → verify → record. Existing pause, quota, remote-only, duplicate and unknown-answer stops remain.

Regression additions cover diverse junior roles with 1–3 metadata, non-.NET internships, hard experience/eligibility gaps, neutral/senior rejection, and requalification of an old Verify frontend record into the automatic queue with a project-grounded letter. The real background orchestration fixture now proves two different role families receive their own letter and confirmed receipts. CI/Windows results are recorded in the release PR. No live HH submission is claimed; the last real browser check encountered HH's VPN restriction.

## 2.7.8 — one-click dashboard application

Inspected main `2a3360014e8feac95f68b154b17e4c0f78e250b5`; branch `feat/dashboard-one-click-apply`. Kept the existing HH API, extension form executor, receipt checks, CRM and Windows packaging. Added a bounded dashboard preparation service with fresh opportunity/remote/exclusion/duplicate checks, shared by the direct API path and browser preparation. The local dashboard bridge executes one selected application with autopilot off, reports per-card progress and uses inactive HH tabs. Persisted manual continuations retain their mode and use the manual receipt endpoint.

Regression coverage: configured threshold, stale score refresh, no submission during preparation, duplicate/exclusion/remote/required-experience/skill checks; actual worker orchestration with letter confirmation, review, inactive tabs, continuation and origin restrictions; Chromium dashboard progress/review/success without navigation. All external calls are deterministic fixtures. No new personal data or secrets are committed. No production success rate is claimed: the last live cloud HH check was blocked by HH's VPN page, and a signed-in real HH pilot remains outstanding.
