# Pipeline Desk — extension v2.0

Pipeline Desk closes the application lifecycle inside the extension by making recruiter-stage updates quick, explicit and analytics-aware.

It does not inspect inboxes, recruiter messages or employer pages to infer outcomes. Violetta decides what happened; the extension only records the selected stage in the existing Job Search Assistant pipeline.

## Source of truth

Pipeline Desk reuses the existing backend:

- `/api/dashboard` supplies active pipeline applications
- `/api/vacancies/{id}/status` records a stage
- `JobService.SetStatusAsync` updates the vacancy and writes an `ApplicationEvent`
- `OutcomeAnalyticsService` immediately uses the new status for response/interview/offer/rejection metrics
- `FollowUpQueueService` only includes vacancies still in `Applied`, so recording a recruiter response automatically removes obsolete follow-up reminders

## Compact transitions

The popup supports normal forward hiring progress:

- Applied → HR contact / HR interview / technical interview / test task / offer / rejected
- HR contact → HR interview / technical interview / test task / offer / rejected
- HR interview → technical interview / test task / offer / rejected
- Technical interview → test task / offer / rejected
- Test task → technical interview / offer / rejected
- Offer is terminal in the compact desk

Exceptional corrections can still be made from the full dashboard rather than allowing accidental backward changes in the compact UI.

## Extension flow

1. Open the extension.
2. Pipeline Desk loads up to 15 active applications from the existing dashboard pipeline.
3. Select the application that received a real recruiter update.
4. Choose the stage that actually happened.
5. Optionally add a short note such as the recruiter channel or interview detail.
6. Press **Record recruiter stage**.
7. Confirm the exact application and stage.
8. The extension calls the existing status endpoint.
9. Pipeline Desk reloads and Follow-up Desk refreshes so obsolete reminders disappear immediately.
10. Outcome analytics now reflect the recorded result.

## Safety boundaries

- No inbox, email, HH conversation or recruiter message is read or interpreted automatically.
- No recruiter reply is sent.
- Every stage update requires a user-selected application, a user-selected valid transition, and an explicit confirmation dialog.
- Vacancy IDs are validated before a write request is constructed.
- Employer links are restricted to HTTP/HTTPS.
- Offer cannot be silently downgraded in the compact desk.
- Notes are limited and sanitized before being sent to the existing backend event log.
- Application recording, follow-ups and pipeline updates remain separate explicit actions.
