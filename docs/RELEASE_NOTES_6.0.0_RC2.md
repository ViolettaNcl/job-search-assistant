# Violetta Apply Assistant 6.0.0 RC2

RC2 focuses on the real application path that was still missing from RC1: dedicated HH questionnaire pages that do not expose a conventional HTML form.

## Application questionnaire Fill

- Detects standalone HH response/questionnaire pages by page context, editable fields and the native response action.
- Adds **✦ Fill** next to the native `Откликнуться / Продолжить / Отправить` action.
- Fills supported fields without pressing the employer's final submit action.
- Adds explicit handling for Gambling/Betting domain experience, chat-sales background, chat/ticket volume, 2/2/night schedule, salary drafts and Telegram.
- Mixed Russian/English questions keep Russian answer language when the surrounding prompt is Russian.
- Unknown factual history is not fabricated. Transferable-experience answers and neutral drafts remain reviewable.

## Real-label local ML

- Adds a browser-side logistic-regression trainer for personal vacancy preference.
- Training requires real user labels; no synthetic labels are promoted as a personal model.
- Requires at least 40 labelled rows with at least 10 positive and 10 negative labels.
- Uses chronological train/calibration/test partitions, calibration threshold selection and held-out metrics.
- Training creates a candidate model only. Promotion remains explicit in Model Registry.

## Migration

- Adds product schema migration for 5.2-style local state to the 6.0 product schema.
- Migrates the model registry to separate preference and engagement active slots.
- Migration writes a patch only and does not intentionally delete vacancy, application, questionnaire or learning state.

## Second provider

- Adds a **Habr Career beta** adapter surface and manifest permission.
- Public vacancy detection/title/description/UI insertion are fixture-covered.
- Authenticated Habr application submission is not claimed live-validated.

## Integrity and signing

- Release files have SHA-256 manifests.
- `VERIFY_RELEASE.ps1` verifies package file hashes.
- Publisher supports an optional signed Git tag using the user's configured Git signing key (`-SignTag`).
- Publisher still refuses force push, dirty trees, unexpected repository origins and unverified package files.

## Deferred to final-final productization

Private Vault hardening remains intentionally deferred as requested. Personal learning model quality remains data-dependent and must be evaluated on real labels before promotion.
