# Standalone mode — 3.9

## Goal
Loading the unpacked `extension/` folder should be enough for the normal browsing workflow.

## Core without backend
- page detection
- floating ✦ Apply UI
- recruiter ✎ AI UI
- Candidate Truth Profile
- local cover-letter strategy
- local contextual replies where facts are sufficient
- quick replies
- CV assets
- application/chat memory in Chrome storage

## Optional backend
The local .NET service is kept for advanced Autopilot queue/dashboard features.

## SPA resilience
HH.ru is an SPA. 3.9 combines MutationObserver, route checks, a small visibility watchdog and service-worker repair of already-open HH tabs.

## Limit
Chrome can still require a manual page refresh in restricted/pre-existing tabs after an extension reload. The UI should no longer disappear merely because the backend is offline.
