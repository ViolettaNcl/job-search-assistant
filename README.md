# Violetta Apply Assistant 6.0.0 RC2

Personal job-search operating system for vacancy analysis, application preparation, questionnaire filling, recruiter context, outcomes and evidence-driven personal learning.

## Core workflow

1. Analyze visible vacancies in bulk.
2. Keep **Fit** separate from **Calls** status.
3. Queue/save/skip/apply using exact vacancy identity.
4. Generate vacancy-specific cover letters.
5. When HH redirects to a dedicated questionnaire, use **✦ Fill** beside the native response action.
6. Review drafts/legal fields and submit only with the site's native final action.
7. Record applications/outcomes and use real decisions as learning labels.
8. Train/import candidate preference models only when enough real labels exist; compare in Shadow Mode before promotion.

## RC2 highlights

- Standalone HH questionnaire detection without requiring a `<form>` tag.
- Inline **✦ Fill** for the real redirect flow shown during user testing.
- Safe realistic fallback drafts for role-specific questions while avoiding fabricated work/legal facts.
- Local real-label logistic-regression trainer in Learning Center.
- Additive 5.2 → 6.0 product migration.
- Habr Career beta adapter surface.
- Release hash verifier and optional signed Git tag.

## Product Center

The 6.0 Product Center provides applications, queue/report views, dataset readiness, model/shadow controls, backup/restore and diagnostics.

## Important boundaries

- Final employer submission stays user-controlled on review-gated forms.
- Automated fixtures do not prove a current authenticated provider flow; run the live acceptance checklist.
- Personal ML quality depends on real labels. The project does not ship a fake pre-trained personal model.
- Habr Career remains beta until its authenticated flow is live-validated.
- Private Vault final hardening is deferred to the final pass as requested.

## Repository publication

Use `Publish-Violetta-6.0.0-RC2.ps1`. It copies only allowlisted, SHA-256-verified source/docs/tests to `ViolettaNcl/job-search-assistant`, refuses dirty/diverged/incorrect repositories and never force-pushes. Use `-SignTag` only when Git signing is already configured on your machine.
