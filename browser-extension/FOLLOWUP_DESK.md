# Follow-up Desk — extension v1.9

Follow-up Desk surfaces the highest-priority recruiter follow-up that is already due according to the Job Search Assistant backend.

It does **not** create a second follow-up schedule. The existing `FollowUpQueueService` remains the source of truth.

## Default backend rules used by the extension

- wait 5 business days after the application or previous follow-up
- only vacancies still in `Applied` status with a real application record are eligible
- blacklisted companies are excluded
- maximum 2 follow-up attempts in the compact extension flow
- stronger-fit and longer-waiting applications rank higher
- watched companies receive the existing backend priority boost
- Russia / HH applications receive the Russian draft and channel recommendation; other markets receive English

## Extension flow

1. Open the extension.
2. Follow-up Desk requests `/api/followups?afterBusinessDays=5&limit=30&maxAttempts=2`.
3. The compact card shows only the highest-priority valid item.
4. Violetta may edit the draft locally in the textarea.
5. **Copy follow-up** only copies text to the clipboard.
6. **Open application** opens only a validated HTTP/HTTPS vacancy URL.
7. Violetta sends the message herself in the recruiter/ATS channel.
8. **I sent this follow-up** asks for explicit confirmation and then records the existing `followup-sent` event.
9. The card reloads and shows the next due application, if any.
10. **Open full follow-up queue** keeps the existing dashboard available for bulk review.

## Safety boundaries

- No email, HH message, ATS message, or recruiter outreach is sent automatically.
- Marking a follow-up sent is a separate explicit action after the candidate says she already sent it.
- Invalid vacancy IDs are rejected before a write request is built.
- Non-HTTP/HTTPS vacancy URLs are never opened.
- Message edits in the popup are not silently persisted or learned.
- The server remains authoritative for eligibility, timing, attempt limits, and status checks.
- If a vacancy has moved beyond `Applied`, the backend rejects `followup-sent` and it disappears from the queue.
