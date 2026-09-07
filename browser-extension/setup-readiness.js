(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaSetupReadiness = api;
})(typeof window !== "undefined" ? window : null, function () {
  function bool(value) { return value === true; }
  function item(id, label, ok, level, detail, action = "") { return { id, label, ok: Boolean(ok), level, detail: String(detail || ""), action }; }

  function build(input = {}) {
    const backendOk = bool(input.backend?.reachable) && input.backend?.ready !== false;
    const candidateOk = bool(input.candidate?.coreReady);
    const contactsReady = bool(input.contacts?.phone);
    const enCv = bool(input.cv?.english);
    const ruCv = bool(input.cv?.russian);
    const bothCvs = enCv && ruCv;
    const queueCount = Math.max(0, Number(input.queue?.strongCount || 0));
    const queueOk = queueCount > 0;

    const items = [
      item("backend", "Backend", backendOk, "required", backendOk ? "Backend is reachable and ready." : "Start/fix the Job Search Assistant backend before using the application autopilot.", "backend"),
      item("candidate", "Candidate profile", candidateOk, "required", candidateOk ? "Verified core candidate facts are available." : "Required candidate facts are incomplete or could not be verified.", "candidate"),
      item("contacts", "Reusable phone", contactsReady, "recommended", contactsReady ? "Phone is available from the verified backend profile or this browser's local contact profile." : "Add your phone once so common contact fields do not need repeated manual entry.", "contacts"),
      item("english-cv", "English CV Vault", enCv, "recommended", enCv ? "English CV is stored locally for employer sites that upload a PDF." : "Store the English PDF once for European/international employer forms that require an upload.", "cv"),
      item("russian-cv", "Russian CV Vault", ruCv, "recommended", ruCv ? "Russian CV is stored locally for Russian employer sites that upload a PDF." : "Store the Russian PDF once for Russian employer forms that require an upload. HH.ru itself uses the resume selected in your HH account.", "cv"),
      item("queue", "Strong-job queue", queueOk, "recommended", queueOk ? `${queueCount} strong unapplied job${queueCount === 1 ? "" : "s"} currently available.` : "No 75+ unapplied jobs are currently available; refresh collection or search/import more jobs.", "queue")
    ];

    let state = "ready";
    let title = "Ready to apply";
    let detail = "Core setup is ready. Apply + send now can use employer-site forms, including the normal HH.ru website flow.";
    if (!backendOk || !candidateOk) {
      state = "blocked"; title = "Setup blocked"; detail = "Fix the required setup items before relying on the application assistant.";
    } else if (!contactsReady || !bothCvs || !queueOk) {
      state = "attention"; title = "Usable, but setup needs attention"; detail = "Applications can still be prepared and HH.ru can use the selected account resume, but finishing the recommended setup will reduce manual work on other sites.";
    }

    const passed = items.filter(x => x.ok).length;
    return {
      state, title, detail, passed, total: items.length, items,
      capabilities: {
        externalAts: backendOk && candidateOk,
        contactAutofill: contactsReady,
        cvAutoload: bothCvs,
        dailyQueue: backendOk && queueOk,
        hhDirect: backendOk && candidateOk
      }
    };
  }

  return { build };
});
