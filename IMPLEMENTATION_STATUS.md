# Implementation status — 3.7.0

| Area | Status |
|---|---|
| Source architecture cleanup | Complete: source uses `browser-extension/` + `src/`; generated backend/test output removed from Git |
| Candidate Truth Profile | Implemented: confirmed / transferable / inference / unknown distinctions |
| RU/EN CV resolver | Implemented: language-based built-in CV selection |
| Bundled CV assets | Implemented |
| Vacancy / role detection | Implemented for current adapters and semantic fallback; live DOM still requires smoke testing |
| Human cover-letter engine | Implemented: short vacancy-first text using confirmed relevant projects/skills |
| IT GitHub portfolio link | Implemented for relevant technical roles |
| Unrelated hospitality suppression | Implemented for developer/QA technical letters |
| Cover Letter Memory | Implemented per application |
| `✦ Apply` | Implemented for supported current-vacancy flows |
| HH search-list quick apply | Implemented for supported HH card/modal flow |
| `✦ Fill` | Retained for safe form filling/review |
| 🚀 main-window Autopilot | Implemented: explicit start/stop + status/limits |
| Autopilot target profile | Remote IT focus with match/seniority/role guards |
| Autopilot limits | Match threshold, session/day limits and bounded execution |
| High-risk application stops | Implemented for ambiguous salary/visa/legal/privacy/work-authorization decisions |
| Application registry / duplicate protection | Implemented through existing storage |
| Recruiter chat AI | Implemented for accessible active DOM with old/unlinked-chat fallback |
| Full-dialog analysis | Implemented with current HH DOM fallback |
| Chat stale-response protection | Implemented |
| Recruiter Send | Manual |
| Quick Replies | Capped to a small Russian set + editable primary reply |
| Timeline / follow-up / analytics | Retained |
| Dedicated live adapters | Partial; see `SUPPORTED_SITES.md` |
| CAPTCHA/MFA bypass | Not implemented |
| Encrypted backup/restore | Not implemented |
| Live-site certification | Not claimed; synthetic tests are not permanent live-DOM guarantees |

## Repository/runtime note

The source repository intentionally does not contain the generated self-contained Windows backend, ZIP release archives or `test-results/`. Windows packages are produced from source by GitHub Actions.

See `TESTING_GUIDE.md` for current verification steps.
