# Continue Application Session — v2.4

After an external employer page shows a strong post-submission confirmation, Violetta Apply Assistant can record that application and surface the next ranked strong vacancy directly inside the Submission Receipt card.

## Flow

1. The content script detects a strong post-submission signal such as “application submitted”, “application received”, a post-application thank-you, or an application-complete confirmation.
2. The popup shows **Record application**. Detection alone never changes CRM state.
3. When the user clicks Record application, the assistant rescans the employer page at that exact moment.
4. Only if the confirmation is still present does the backend mark the tracked vacancy as Applied.
5. The active application session is cleared and the ranked 75+ queue is refreshed.
6. If another strong unapplied vacancy exists, the receipt card shows **Continue to next NN/100 job** with the next title/company/score.
7. Opening the next employer page requires a second explicit click. The new job opens in a new tab so the confirmation page is not destroyed.

## Safety properties

- A detected receipt never changes CRM state by itself.
- Navigation never happens silently after recording.
- The continuation button is disabled until the current application has been successfully recorded.
- Only HTTP/HTTPS vacancy URLs are eligible for continuation.
- If the queue has no other 75+ vacancy, the card says so and does not offer navigation.
- The existing backend queue remains the source of ranking, fit and eligibility; v2.4 does not create a second queue.

## Why this exists

Before v2.4 the queue refreshed automatically after a verified submission, but the user still had to move back to the Daily Apply Loop card to open the next vacancy. v2.4 removes that navigation friction without weakening the explicit review/submit boundaries of external ATS sites.

## Tests

`application-continuation.test.js` covers:

- hidden state before the application is recorded;
- disabled state when no next strong job exists;
- title/company/score rendering for a valid next job;
- HTTP/HTTPS-only navigation;
- score bounding and safe label shortening.

The full CI suite continues to exercise submission receipt detection/session restoration, queue selection, deferral, final review, and all existing application controls.
