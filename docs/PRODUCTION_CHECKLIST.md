# Production Checklist · 5.2

## Before publishing

- [ ] Extension manifest reports 5.2.0.
- [ ] Full Node regression suite passes.
- [ ] Targeted Chromium HH/memory/questionnaire/batch tests pass.
- [ ] ML operations tests pass.
- [ ] Source-publication tests pass.
- [ ] Repository hygiene passes.
- [ ] No runtime ZIP/DLL/EXE/database/log is tracked.
- [ ] Publisher dry-run verifies hashes/allowlist.

## Live HH smoke test

Synthetic fixtures do not certify future HH DOM changes. Before relying on the release, manually verify:

- [ ] single Analysis on a no-calls vacancy;
- [ ] single Analysis on a calls vacancy;
- [ ] Batch Analysis and queue;
- [ ] vacancy-specific Apply + letter;
- [ ] employer-already-viewed close path if encountered;
- [ ] questionnaire autofill/correction capture;
- [ ] Back/reload memory restore;
- [ ] pre-submit diff on a multi-field form.

## Learning/model test

- [ ] Apply/Skip/Save creates events.
- [ ] Dataset exports contain the expected target only.
- [ ] Imported candidate is inactive until promotion.
- [ ] test-only/synthetic candidate cannot promote.
- [ ] disabling preference ML leaves rules Fit operational.

## Rollback

If a new runtime model behaves poorly, disable it first; do not downgrade the entire extension unless the bug is unrelated to the model. Git release publication keeps normal history and does not force-push.
