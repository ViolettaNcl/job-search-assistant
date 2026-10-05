# Roadmap · after 6.0.0 RC2

The broad engineering roadmap is effectively closed. Remaining work should be evidence-driven rather than feature-count driven.

## Before 6.0 Final
1. Run the live HH acceptance checklist, including a dedicated questionnaire redirect.
2. Confirm 5.2 → 6.0 state preservation on the user's real browser profile.
3. Fix only issues found in live acceptance.
4. Finalize release metadata/checksums and, optionally, a signed Git tag.
5. Perform the requested final Private Vault hardening pass.

## Data-dependent after release
- Accumulate real Apply/Save/Skip/Fit-feedback labels.
- Train the local preference model only after minimum label requirements are met.
- Compare candidate vs rules/production in Shadow Mode; promote only when held-out evidence improves.
- Accumulate employer outcomes separately before training engagement models.

## Provider expansion
Habr Career is beta. Do not add a third provider until the Habr authenticated flow is validated and maintained without regressing HH.
