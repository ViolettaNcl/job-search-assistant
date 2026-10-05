# 6.0.0 RC1 — Product Center & Recovery

Release candidate based on 5.2.0. Not a blanket production certification.

Added local Product Center (overview, weekly counts, application pagination/timeline, queue view, dataset quality, model comparison/shadow/rollback, onboarding and redacted diagnostics).
Added password-protected backup export/import and encrypted IndexedDB checkpoints; runtime Chrome storage remains unencrypted. Restore requires preview and confirmation and pauses restored actions/models.
Fixed learning write races, repeated-signal amplification, provider ID collisions, office eligibility, censored closed outcomes, ROC-AUC ties and globally disjoint temporal splits.
Added questionnaire memory gateway for restricted storage contexts and model identity/hash protection.
Source-only update package excludes unchanged personal CV/seed files. Publication is guarded by old/new content hashes and never resets history or force-pushes.

Remaining: live RC validation on the user's HH session; native extension/IndexedDB lifecycle validation in a unrestricted Windows Chrome environment; broader provider support and full working-data vault migration.
