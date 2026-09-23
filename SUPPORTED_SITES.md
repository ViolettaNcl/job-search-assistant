# Supported sites — 3.7.0

> Support is reported by behavior and confidence level, not by marketing labels.

## HH.ru — primary integration

### Implemented

- vacancy discovery and identity helpers;
- current-vacancy **✦ Apply**;
- native search-list quick apply + cover letter;
- recruiter chat detection + **✎ AI**;
- full-dialog analysis fallback;
- user-started **🚀 Autopilot**;
- match/seniority/role guards;
- session/day limits;
- duplicate/application tracking.

### Confidence

**High for tested local fixtures, medium for live DOM longevity.**

HH.ru can change vacancy cards, chat containers, modal editors and resume-selection UI. A release therefore still needs a small live smoke test after major site changes.

---

## Other platforms

| Platform | Current level | Notes |
|---|---|---|
| LinkedIn Jobs | ◐ Partial | IDs/selectors + generic form logic; Easy Apply variants need live validation |
| Indeed | ◐ Partial | Vacancy identity + generic forms; chat/custom controls not certified |
| Greenhouse | ◐ Partial | Strong semantic/native form compatibility; custom widgets may need review |
| Lever | ◐ Partial | Semantic/native forms; custom flows may differ |
| Ashby | ◐ Partial | Generic/native form support; live variants need smoke testing |
| Workday | ◐ Partial | Vacancy/requisition detection + generic fields; wizard controls remain difficult |
| SmartRecruiters | ◐ Partial | Semantic fallback |
| Teamtailor | ◐ Partial | Semantic fallback |
| Workable | ◐ Partial | Semantic fallback |

---

## Generic mode

For unknown career pages the extension can attempt to infer:

- JobPosting / JSON-LD vacancy data;
- title, company and description;
- native form controls;
- resume/CV uploads;
- obvious intermediate steps;
- recruiter reply fields when semantics are accessible.

Generic mode is **best-effort**. It should stop on ambiguity rather than inventing intent.

---

## Explicitly limited / manual

- closed Shadow DOM;
- canvas/non-text recruiter UIs;
- cross-origin frames without permission;
- highly virtualized custom ATS controls;
- nonstandard rich-text editors;
- CAPTCHA / MFA / anti-bot challenges;
- employer-specific legal declarations;
- ambiguous final actions.

Browser security boundaries are not bypassed.
