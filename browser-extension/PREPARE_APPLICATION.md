# Prepare application — v1.4

`Prepare application` is the fast review-first workflow for an opened vacancy.

One explicit click performs the deterministic parts of the application sequence:

1. extracts the currently opened vacancy;
2. asks the backend for the fit score and truthful role-specific application draft;
3. scans the current ATS form;
4. fills only fields already classified as safe;
5. verifies that those values actually persisted after React/ATS state updates;
6. attempts to insert the recommended English/Russian PDF from the local CV Vault when a confident résumé input is available;
7. rescans the form;
8. refreshes submission readiness and ATS stage intelligence;
9. saves the active multi-step application session;
10. stops and reports exactly what still needs candidate review.

## It deliberately does not

- click the final Submit/Apply control on external ATS sites;
- bypass CAPTCHA or 2FA;
- answer legal, security, medical, demographic or identity-document questions automatically;
- overwrite existing form answers;
- invent missing candidate facts;
- treat a failed React/ATS input event as successful;
- open CV Vault settings automatically merely because the recommended PDF is not stored.

HH.ru submission remains its own explicit **Apply on HH via official API** action and retains its separate confirmation step.

## Result states

- **Prepared ✓** — the current detected stage has no unresolved review/manual/autofill failures.
- **Prepared — review needed** — one or more detected fields, a missing required local CV, or an autofill verification failure needs candidate attention.
- **Tailored — open application form** — the vacancy was analyzed successfully but the current page does not expose application controls yet.
- **Preparation failed** — analysis or a required deterministic step failed; the popup shows the error instead of claiming success.

A `Prepared ✓` state covers only controls detected by the extension. The candidate still reviews the employer page and makes the final external submission decision.