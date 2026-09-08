(function () {
  const $ = id => document.getElementById(id);

  async function getApiBaseForContacts() {
    const stored = await chrome.storage.sync.get({ apiBase: "http://localhost:8080" });
    return String(stored.apiBase || "http://localhost:8080").trim().replace(/\/$/, "");
  }

  async function getContactMemory() {
    const stored = await chrome.storage.local.get({ applicationMemory: {} });
    return stored.applicationMemory || {};
  }

  async function refreshContactProfileStatus() {
    const node = $("profileStatus");
    if (!node || !window.vjaLocalContactProfile) return;
    try {
      const api = await getApiBaseForContacts();
      const [response, memory] = await Promise.all([
        vjaFetch(`${api}/api/candidate`, { cache: "no-store" }),
        getContactMemory()
      ]);
      if (!response.ok) throw new Error(`Candidate profile returned ${response.status}.`);
      const candidate = await response.json();
      const readiness = candidate.readiness || {};
      if (readiness.coreReady === false) {
        const missing = (readiness.missingCoreFields || []).join(", ") || "required facts";
        node.textContent = `Profile incomplete: verify ${missing} before relying on autofill.`;
        return;
      }

      const contacts = window.vjaLocalContactProfile.resolve({ candidate, memory });
      if (contacts.bothReady) {
        node.textContent = "Core profile ready. Phone and LinkedIn are available from the verified profile or this browser's local contact profile.";
        return;
      }

      const missing = [];
      if (!contacts.phoneReady) missing.push("phone");
      if (!contacts.linkedinReady) missing.push("LinkedIn");
      node.textContent = `Core profile ready. Add ${missing.join(" and ")} once in Setup & Readiness to reduce repeated manual contact fields.`;
    } catch (error) {
      node.textContent = `Could not verify candidate profile: ${error?.message || String(error)}`;
    }
  }

  $("openSetup")?.addEventListener("click", () => chrome.runtime.openOptionsPage());

  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === "local" && changes.applicationMemory) || (area === "sync" && changes.apiBase)) {
      refreshContactProfileStatus().catch(() => {});
    }
  });

  window.addEventListener("load", () => {
    refreshContactProfileStatus().catch(() => {});
    setTimeout(() => refreshContactProfileStatus().catch(() => {}), 750);
  }, { once: true });
})();
