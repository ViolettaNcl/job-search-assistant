# Supported Sites · 6.0.0 RC2

## HeadHunter / HH

Primary provider. Supported architecture includes search-card intelligence, exact vacancy reading, Calls analysis, Fit/queue, vacancy-specific application preparation, dedicated questionnaire Fill, memory and recruiter/application workflows.

Live DOM/API changes can still require selector maintenance, so a real-account smoke test remains part of release acceptance.

## HeadHunter.kg

Shares the HH adapter family and remains covered by legacy application regression fixtures.

## Habr Career — beta

`https://career.habr.com/*` is enabled in RC2. The adapter recognizes vacancy pages, extracts vacancy identity/title/company/description and can render the assistant surface. The generic application/questionnaire infrastructure can be reused when the current authenticated flow exposes compatible fields.

**Not yet claimed:** fully live-validated authenticated Habr apply, questionnaire and final submission flow. Final employer submission remains user-controlled.

## Other providers

The formal adapter contract exists, but no other site should be called supported until its current live flow is inspected and tested.
