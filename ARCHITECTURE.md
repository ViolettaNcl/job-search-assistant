# Architecture — 6.0 RC1

The existing service worker, application store and HH content scripts are retained.

## Added modules

`product-core.js`: pure backup schema validation/allowlist, restore plan, quality checks, read models and diagnostics.
`product-crypto.js`: AES-256-GCM password-protected snapshots using PBKDF2-SHA256 and random salt/nonce.
`product-store.js`: extension-origin IndexedDB, schema 1, encrypted checkpoint records. Not injected on job websites.
`product-models.js`: canonical model digest, integrity checks and post-prediction shadow comparison.
`product-background.js`: extension-page-only administrative routes for restore, shadow selection and model rollback.
`product.html/js/css`: local dashboard; never clicks employer submit controls.

## Trust boundaries

Operational Chrome local storage remains the existing source of truth. New IndexedDB stores encrypted checkpoints only, so no destructive migration of the working history occurs. The content-script questionnaire gateway can request one answer or store one bounded answer; it cannot invoke product restore or model administration.

The service worker serializes learning writes. Restored jobs are review-only; model active pointers and external AI consent are reset. Backend submission is not triggered by dashboard operations.

## Models

Training now uses global chronological boundaries, not per-class time partitions that can overlap. Missing temporal groups fail closed. Shadow predictions never blend into Fit. Comparison counts only labels later than the prediction. Model metrics are reported as observational, not causal or a job-offer guarantee.

## Storage and scale

Application pages render 25 records at a time. The center reads local state on opening/manual refresh; it does not poll or crawl. Encrypted backups are limited to 32 MiB plaintext; files over the supported limits are rejected. The large operational stores have not all been migrated to IndexedDB; that remains a separate, testable migration project.
