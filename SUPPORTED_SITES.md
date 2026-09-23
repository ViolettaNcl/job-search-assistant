# Supported sites — 3.7.0

Support levels describe implemented behavior, not permanent certification of a live site's DOM.

## HH.ru

### Implemented

- vacancy discovery / parsing helpers;
- current-vacancy **✦ Apply**;
- native search-list quick apply with vacancy-specific cover letter for supported HH flows;
- recruiter-chat detection and **✎ AI**;
- full-dialog analysis with current-DOM fallbacks;
- user-controlled **🚀 Autopilot**;
- match-score, role, seniority and session/day limits;
- duplicate/application tracking.

### Important limitations

HH.ru can change card, chat, modal and resume-selection DOM at any time. A synthetic regression passing today is not a guarantee for every production account/UI variant.

Ambiguous high-risk fields must stop rather than be guessed.

## Partially supported platforms

| Platform | Current support | Limitations |
|---|---|---|
| LinkedIn Jobs | selectors / IDs / generic form logic | Easy Apply variants, messaging and custom widgets require live validation |
| Indeed | job identity + generic form handling | login/custom controls/chat not certified |
| Greenhouse | semantic/native form support | custom widgets and cross-domain flows may require review |
| Lever | semantic/native form support | custom controls may require review |
| Ashby | semantic/native form support | live variants require smoke testing |
| Workday | requisition/title/description detection + generic fields | complex wizards/custom controls require review |
| SmartRecruiters | semantic fallback | live variants require validation |
| Teamtailor | semantic fallback | live variants require validation |
| Workable | semantic fallback | live variants require validation |

## Generic mode

The generic adapter can attempt to detect:

- JobPosting/JSON-LD vacancy data;
- title/company/description;
- native inputs/selects/radios/checkboxes;
- resume/CV uploads;
- obvious intermediate controls;
- recruiter reply fields where semantics are available.

Unknown sites are best-effort. The assistant should stop on ambiguity instead of guessing.

## Needs a dedicated adapter / manual step

- canvas-rendered or inaccessible chat UIs;
- closed Shadow DOM;
- cross-origin iframes without permission;
- virtualized/custom ATS controls with weak semantics;
- nonstandard rich-text editors;
- CAPTCHA / MFA / anti-bot challenges;
- employer-specific legal declarations;
- ambiguous final actions.

## Permission model

The extension requests HH.ru access by default and may request additional origins when the user enables support for another employer site.

Browser security restrictions are not bypassed.
