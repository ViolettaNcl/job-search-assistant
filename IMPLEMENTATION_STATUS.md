# Implementation status — 3.7.0

## Product status

| Area | Status | Notes |
|---|---|---|
| Source cleanup | ✅ Complete | One extension source: `browser-extension/`; generated release files excluded |
| Candidate Truth Profile | ✅ Implemented | Confirmed / transferable / inference / unknown |
| RU/EN CV resolver | ✅ Implemented | Simplified language-based selection |
| Bundled CV assets | ✅ Implemented | Stored as extension assets |
| Vacancy / role detection | ✅ / ◐ | Adapter + semantic fallback; live DOM can change |
| Human cover letters | ✅ Implemented | Short, vacancy-first, confirmed skills/projects |
| IT GitHub portfolio link | ✅ Implemented | Added where relevant |
| Unrelated hospitality suppression | ✅ Implemented | Technical letters avoid irrelevant repetition |
| Cover Letter Memory | ✅ Implemented | Per-application exact text/context |
| ✦ Apply | ✅ Implemented | Supported current-vacancy flow |
| HH search-list quick apply | ✅ / ◐ | Supported HH flow; DOM-sensitive |
| 🚀 Autopilot | ✅ Implemented | Explicit start/stop, status and limits |
| Match / seniority guards | ✅ Implemented | Junior-compatible remote IT focus |
| High-risk field stops | ✅ Implemented | Salary/visa/legal/privacy/etc. |
| Recruiter Chat AI | ✅ / ◐ | Active DOM + fallback; live chat DOM can change |
| Full-dialog analysis | ✅ Implemented | With stale-response protection |
| Quick Replies | ✅ Implemented | Small Russian set + editable primary |
| Timeline / follow-up / analytics | ✅ Retained | Existing system preserved |
| Dedicated multi-site adapters | ◐ Partial | See `SUPPORTED_SITES.md` |
| Encrypted backup/restore | ⏳ Planned | See `ROADMAP.md` |
| CAPTCHA/MFA bypass | ❌ Out of scope | Not implemented |
| Permanent live-site certification | ❌ Not claimed | Requires smoke tests |

## Release engineering

The repository stores source and docs only. Windows runtime binaries, ZIP packages, screenshots/test-output and hash dumps are CI/release artifacts.

## Confidence model

**Green** means the feature exists and is covered by local/synthetic regression.

It does **not** mean an external employer site cannot change its UI tomorrow.
