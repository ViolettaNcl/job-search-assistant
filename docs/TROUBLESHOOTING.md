# Troubleshooting · 5.2

## Analysis shows Retry

Possible causes include HH navigation/content-script timing, temporary HH API failure or missing host permission. Reload the HH page, verify extension site access, then retry. Current reader logic does not require the tab to remain `complete`; it accepts a readable exact vacancy DOM and can use `api.hh.ru` fallback.

## Fit and Calls seem inconsistent

They are different signals. Fit is role/profile ranking; Calls is a separate safety/requirement classification. A high Fit vacancy can still be excluded if Calls are required and calls are disabled.

## Questionnaire field stayed empty

This may be intentional when the answer requires an unconfirmed factual/legal value, a numeric salary, or a DOM write cannot be verified. Subjective free text may receive a reviewable draft. Edit suggestions when needed; trusted edits become correction-learning events.

## Model import works but Fit does not change

Import creates a candidate only. The model must pass explicit promotion. Preference ML also has to be enabled by promotion and remains a bounded contribution.

## Model cannot be promoted

Expected reasons include test-only/synthetic training metadata, insufficient held-out sample size, F1 below the floor or regression against the active same-target model.

## Monitoring is empty

Monitoring requires predictions made by an active model followed by later real labels. Before that, there is no honest post-promotion performance sample to score.

## Semantic memory does not reuse an answer

The fallback only considers confirmed generic answers in the same category and requires sufficient local semantic similarity. Vacancy-specific answers are intentionally excluded.

## Backend does not start

Core extension functions continue without the optional backend. Use `BACKEND_DIAGNOSTICS.cmd` for advanced dashboard/server workflows.
