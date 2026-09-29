# Submission Receipt — extension v1.8

Submission Receipt closes the gap between a candidate-controlled employer submission and the Job Search Assistant CRM.

## Flow

1. Violetta prepares and reviews the application with the existing safe workflow.
2. Violetta personally presses the employer's final Submit/Apply control.
3. If the employer page shows a strong post-submission confirmation, the extension surfaces a **Submission receipt** card when reopened.
4. Nothing is written to the CRM automatically.
5. Violetta reviews the employer confirmation and presses **Record application**.
6. The extension re-scans the page at that exact moment. Only if the strong confirmation is still present does it call the existing `mark-applied` CRM endpoint.
7. The ephemeral ATS application session is cleared and the ranked daily queue is refreshed. The next job is not opened automatically.

## Receipt evidence

Strong signals include confirmation text such as:

- application submitted
- application received
- thank you for applying
- application complete
- Russian equivalents for a submitted/received application or response

A confirmation-looking URL by itself is never enough.

The detector explicitly rejects failure and instructional copy such as:

- application was not submitted
- submission failed
- before you submit your application
- after you submit, you will see “Thank you for applying”

## Safety boundaries

- Employer Submit/Apply remains human-controlled.
- Receipt detection never changes CRM state by itself.
- **Record application** is an explicit candidate action.
- The success signal is revalidated immediately before recording.
- Receipt page text is not stored in application memory or the ATS session.
- Session restoration to confirmation/thank-you routes remains restricted to the same origin or the same recognized ATS tenant.
- Shared ATS hosts cannot restore context across employers.
- Recording refreshes the queue but does not automatically open or apply to another vacancy.
