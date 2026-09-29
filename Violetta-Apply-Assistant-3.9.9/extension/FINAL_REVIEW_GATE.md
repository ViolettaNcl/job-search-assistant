# Final Review Gate — extension v1.7

The Final Review Gate is the handoff from assisted preparation to the candidate's final employer-side submission.

## Flow

1. **Prepare application** analyzes, tailors, fills verified-safe fields and attempts the recommended CV.
2. **Next field needing me** navigates unresolved review/manual/failed-fill checkpoints.
3. **I reviewed this field — next** closes candidate-reviewed checkpoints without storing raw answers.
4. **Check final review** re-scans the current employer form and refuses to advance while detected unresolved fields remain.
5. If an upload field exists but the extension cannot prove the attachment, **I verified the CV attachment** lets the candidate explicitly close that attachment checkpoint after checking the employer page.
6. When the detected checklist is clear, the extension searches conservatively for one unambiguous final Submit/Apply control and highlights it.
7. **I reviewed the full form** performs another fresh scan before declaring the handoff ready.
8. The candidate uses the employer's final Submit/Apply action herself.

## Submit-control rules

The extension never clicks a final employer control.

The locator ignores controls labelled like Next, Continue, Back, Save, Draft, Cancel, Preview or Review. A plain Apply/Apply now control is not considered a final action on an ordinary vacancy page; it must be inside a form or on an application-like route. If multiple equally plausible final controls are found, none is highlighted.

## Attachment rule

An extension-inserted CV can be tracked by filename. If an ATS reused an existing profile attachment or the candidate uploaded a file manually, the extension does not guess which file is present. It requires explicit candidate verification before the final gate can advance.

## Safety boundary

A clear assistant checklist is not proof that an employer form is legally or factually complete. The Final Review Gate only verifies the extension's detected state and provides a conservative navigation aid. Legal declarations, sensitive answers, attachments and the full employer page remain the candidate's responsibility.
