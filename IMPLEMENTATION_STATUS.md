# Implementation Status · 6.0.0 RC2

## Implemented and regression-covered

### HH search and application
- Exact vacancy-ID binding, full-vacancy reader and `api.hh.ru` fallback.
- Calls / no-calls / unknown classification.
- Batch Analysis, explainable Fit, Ready Queue, Save/Skip/Apply and persistent vacancy memory.
- Vacancy-specific cover letters and already-viewed recovery.
- Dedicated HH questionnaire-page detection even when no semantic `<form>` exists.
- Inline **✦ Fill** next to the native response action; Fill does not press final submit.
- Questionnaire classification, confirmed-answer memory, semantic fallback retrieval, user-correction capture and pre-submit review.

### Personal learning / ML
- Structured LearningEvent store and deduplicated preference labels.
- Separate preference and employer-engagement targets.
- Offline Python train/calibration/test pipeline and model registry.
- Browser runtime inference, monitoring/drift, Shadow Mode, rollback/disable.
- **RC2:** real-label browser-side logistic trainer that creates a candidate model from the user's own labels. It does not auto-promote.

### Productization
- Unified Product Center and diagnostics.
- Password-protected backup/restore with preview.
- 5.2 → 6.0 product-schema migration foundation.
- Release file hashes, verification script and optional signed Git release tag.

### Providers
- HH: primary validated provider architecture and extensive automated/live-user workflow history.
- Habr Career: **beta** public-vacancy adapter/assistant surface; authenticated apply still requires live acceptance.

## Intentionally not claimed

- No promise of zero defects.
- Automated browser fixtures do not equal a live authenticated HH/Habr acceptance test.
- No personal ML model is claimed high-quality before enough real user labels/outcomes exist.
- No fabricated work history/legal facts are inserted merely to fill a questionnaire.
- Habr Career is not labelled fully supported until authenticated apply/questionnaire paths pass live smoke testing.
- Private Vault finalization is deferred to the final hardening pass as requested.
