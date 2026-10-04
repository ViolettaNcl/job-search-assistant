# Privacy and Local Data · 5.2

## Local runtime state

The extension keeps vacancy/application/questionnaire/learning/model-registry state locally by default. Important families include:

- job preferences;
- per-vacancy intelligence and decisions;
- application/questionnaire memory;
- `vjaLearningEventsV1` learning events;
- local model registry with imported model artifacts.

## Learning exports

Learning Center can export:

- full learning backup JSON;
- preference dataset JSONL;
- employer-engagement dataset JSONL.

These files may contain job context and behavioral labels. Treat them as private data and store them locally unless you intentionally share them.

## Reset controls

Reset Learning removes learning events and local model-registry state. It does not delete CVs or application history. Model disable is separate from data reset.

## Candidate assets

The personalized FULL/extension bundle can contain CV assets and candidate seed/profile information. If the Git repository tracks those files, making the repository public exposes them to anyone who can access that revision. Switching back to private later does not revoke copies already downloaded.

A future encrypted external vault may further separate personal assets from source distribution, but 5.2 should not be described as providing encrypted vault storage.

## Secrets

Do not commit API keys, `.env`, `candidate.private.json`, `appsettings.local.json`, `user-settings.cmd`, browser cookies or authentication tokens. Repository hygiene and the release publisher block known runtime/secret paths, but they do not replace human review of repository visibility.

## Models

Imported/trained model artifacts are local files/state unless deliberately committed. A model may encode behavioral patterns even when direct PII is excluded; treat personal model artifacts as private.
