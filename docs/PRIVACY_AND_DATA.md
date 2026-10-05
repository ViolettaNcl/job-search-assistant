# Privacy and data — 6.0 RC2

Runtime data remain local unless the user enables an external AI provider. The Product Center itself makes no network requests for analytics or telemetry.

Backup exports and IndexedDB checkpoints are encrypted. Active Chrome storage is not encrypted by this release. Do not describe the product as providing a fully encrypted external working vault.

The personalized FULL/Standalone distribution retains candidate seed and CV assets from 5.2.0 for compatibility. Do not upload the FULL directory or .vja/.jsonl files into a repository.

GITHUB-UPDATE is a delta: only changed source files/docs/tests; it excludes unchanged candidate-seed.js, profile-defaults.js, CV PDFs and candidate-source/requirements documents. This does not remove earlier personal data already tracked in the repository or history. Repository visibility remains the owner's responsibility.

The updater adds ignore rules for backup/dataset/runtime artifacts and verifies intended paths. Hygiene is not a content-level secret scanner.

No production model is bundled or silently trained. User-created artifacts and datasets can encode behavioral information and should be treated as private.
