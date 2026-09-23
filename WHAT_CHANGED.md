# Violetta Apply Assistant 3.7.0

## Release highlight

**The assistant now feels like one product rather than a collection of tools.**

### 🚀 Autopilot in the main popup

The compact popup now exposes one clear start/stop control for the existing automation pipeline.

Autopilot combines vacancy discovery, match score, junior-compatible seniority checks, role targeting, session/day limits and background application execution.

### ✦ Apply became the direct action

The floating **✦ Apply** action now maps to the application workflow for the currently opened vacancy without redirecting through an internal extension page.

### ⚡ Faster HH list applications

A native user click on HH.ru **Откликнуться** can trigger a vacancy-specific cover-letter continuation for that exact card.

### ✎ Chat AI became conversation-aware

`🧠 Проанализировать весь диалог и ответить` reads the accessible active recruiter conversation and drafts for the latest message while preserving stale-response protection.

### 📝 Better cover letters

Technical letters are now:

- shorter;
- vacancy-first;
- based on matching confirmed projects/skills;
- less repetitive;
- free from unrelated hospitality emphasis;
- able to include `https://github.com/ViolettaNcl` for relevant IT roles.

### 🧠 Cover Letter Memory

The system retains the exact cover letter and CV context for each application so later recruiter replies can be grounded in what was actually sent.

### 🧹 Repository cleanup

The source tree now has one extension source (`browser-extension/`). Generated Windows runtime files, release ZIPs and test-output folders are excluded from Git.

### 🔧 Backend startup consistency

Local backend and extension use `http://127.0.0.1:8080`, with dedicated launcher/diagnostic scripts in Windows release bundles.

---

See `IMPLEMENTATION_STATUS.md` for detailed feature status and `ROADMAP.md` for next engineering priorities.
