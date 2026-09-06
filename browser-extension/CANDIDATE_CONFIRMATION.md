# Candidate Confirmation — extension v1.6

Candidate Confirmation closes the manual-review loop without turning sensitive ATS questions into automated answers.

## Workflow

1. Run **Prepare application**.
2. Use **Next field needing me** to jump to an unresolved review, failed-fill or manual-only field.
3. Answer or inspect that field directly on the employer page.
4. Click **I reviewed this field — next**.
5. The current field becomes resolved for this application session and the navigator moves to the next unresolved checkpoint.

## Privacy model

The extension does not save the employer question text or the answer value when a checkpoint is confirmed.

It generates a random per-session salt and stores only:

- a salted SHA-256 fingerprint of the normalized field identity;
- a salted SHA-256 fingerprint of that field identity plus the normalized current value;
- the confirmation timestamp.

The confirmation state is sanitized before being written to the existing ephemeral `chrome.storage.session` application record. It follows the same eight-hour lifetime and the same strict ATS tenant/opener handoff rules as the rest of the multi-step application session.

## Automatic invalidation

Every form rescan recomputes the salted fingerprint from the field's current value. If the value changes, the saved fingerprint no longer matches and the field immediately returns to the unresolved checklist.

A field that disappears or is rebuilt with a materially different identity also loses its confirmation conservatively.

## Safety boundary

Candidate Confirmation means only that Violetta manually reviewed the current employer-side value. It does not mean the assistant independently validated the truth of legal, demographic, medical, security, identity or other sensitive answers.

The extension still does not generate, choose or submit those answers automatically, and final external **Submit/Apply** remains candidate-controlled.
