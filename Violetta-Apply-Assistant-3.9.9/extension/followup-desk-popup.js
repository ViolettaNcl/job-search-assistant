let vjaNextFollowUp = null;

function vjaEnsureFollowUpDeskUi() {
  let card = $("followUpDeskCard");
  if (card) return card;

  const anchor = $("dailyLoopCard") || $("profileStatus");
  if (!anchor) return null;

  card = document.createElement("section");
  card.id = "followUpDeskCard";
  card.className = "followUpDeskCard";

  const top = document.createElement("div");
  top.className = "followUpDeskTop";
  const identity = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "small";
  eyebrow.textContent = "Follow-up Desk · due applications";
  const title = document.createElement("strong");
  title.id = "followUpTitle";
  title.textContent = "Checking follow-ups…";
  const company = document.createElement("span");
  company.id = "followUpCompany";
  company.className = "followUpCompany";
  company.textContent = "—";
  identity.append(eyebrow, title, company);
  const due = document.createElement("span");
  due.id = "followUpDue";
  due.className = "followUpDue";
  due.textContent = "—";
  top.append(identity, due);

  const meta = document.createElement("p");
  meta.id = "followUpMeta";
  meta.className = "followUpMeta";
  meta.textContent = "The backend waits 5 business days by default and prioritizes the strongest unanswered applications.";

  const message = document.createElement("textarea");
  message.id = "followUpMessage";
  message.className = "followUpMessage";
  message.setAttribute("aria-label", "Follow-up draft");

  const actions = document.createElement("div");
  actions.className = "followUpActions";
  const copy = document.createElement("button");
  copy.id = "copyFollowUp";
  copy.className = "secondary";
  copy.textContent = "Copy follow-up";
  const open = document.createElement("button");
  open.id = "openFollowUpJob";
  open.className = "secondary";
  open.textContent = "Open application";
  const sent = document.createElement("button");
  sent.id = "markFollowUpSent";
  sent.className = "primary fullRow";
  sent.textContent = "I sent this follow-up";
  const full = document.createElement("button");
  full.id = "openFollowUpDesk";
  full.className = "secondary fullRow";
  full.textContent = "Open full follow-up queue";
  actions.append(copy, open, sent, full);

  const status = document.createElement("p");
  status.id = "followUpStatus";
  status.className = "followUpStatus";
  status.textContent = "Loading…";

  card.append(top, meta, message, actions, status);
  anchor.insertAdjacentElement("afterend", card);

  copy.addEventListener("click", vjaCopyFollowUp);
  open.addEventListener("click", vjaOpenFollowUpApplication);
  sent.addEventListener("click", vjaMarkFollowUpSent);
  full.addEventListener("click", vjaOpenFullFollowUpDesk);
  return card;
}

function vjaSetFollowUpBusy(busy) {
  for (const id of ["copyFollowUp", "openFollowUpJob", "markFollowUpSent", "openFollowUpDesk"]) {
    const node = $(id);
    if (node) node.disabled = busy;
  }
}

function vjaRenderFollowUp(item, total = 0) {
  const card = vjaEnsureFollowUpDeskUi();
  if (!card) return;
  vjaNextFollowUp = item || null;

  if (!item) {
    card.classList.add("isEmpty");
    $("followUpTitle").textContent = "No follow-up due today";
    $("followUpCompany").textContent = "Applications appear here after enough business days pass without a response.";
    $("followUpDue").textContent = "Clear";
    $("followUpMeta").textContent = "The server currently has no eligible Applied application due for a follow-up under the 5-business-day / 2-attempt rule.";
    $("followUpMessage").value = "";
    $("followUpStatus").textContent = "No outreach needed right now.";
    return;
  }

  card.classList.remove("isEmpty");
  $("followUpTitle").textContent = item.title;
  $("followUpCompany").textContent = item.company;
  $("followUpDue").textContent = `${item.businessDaysWaiting} business days`;
  const attempt = window.vjaFollowUpDesk.attemptNumber(item);
  const language = item.language === "ru" ? "RU" : "EN";
  $("followUpMeta").textContent = `Fit ${item.matchScore}/100 · ${language} · attempt ${attempt} · ${item.recommendedChannel || "manual recruiter channel"} · priority ${item.priorityScore}`;
  $("followUpMessage").value = item.message;
  $("followUpStatus").textContent = `${total} due follow-up${total === 1 ? "" : "s"} checked. Edit the draft if needed; nothing is sent by the extension.`;
  $("openFollowUpJob").disabled = !item.url;
}

async function vjaLoadFollowUpDesk({ quiet = false } = {}) {
  const card = vjaEnsureFollowUpDeskUi();
  if (!card || !window.vjaFollowUpDesk) return null;
  if (!quiet) {
    $("followUpStatus").textContent = "Checking due applications…";
    vjaSetFollowUpBusy(true);
  }

  try {
    const api = await getApiBase();
    const response = await vjaFetch(`${api}/api/followups?afterBusinessDays=5&limit=30&maxAttempts=2`);
    if (!response.ok) throw new Error(`Follow-up queue returned ${response.status}.`);
    const items = await response.json();
    const next = window.vjaFollowUpDesk.selectNext(items);
    vjaRenderFollowUp(next, Array.isArray(items) ? items.length : 0);
    return next;
  } catch (error) {
    vjaNextFollowUp = null;
    card.classList.add("isEmpty");
    $("followUpTitle").textContent = "Follow-up queue unavailable";
    $("followUpCompany").textContent = "Your application and daily-queue workflow is unaffected.";
    $("followUpDue").textContent = "—";
    $("followUpMeta").textContent = error?.message || String(error);
    $("followUpStatus").textContent = "Open the full dashboard later or refresh the extension.";
    return null;
  } finally {
    vjaSetFollowUpBusy(false);
    if (vjaNextFollowUp && $("openFollowUpJob")) $("openFollowUpJob").disabled = !vjaNextFollowUp.url;
  }
}

async function vjaCopyFollowUp() {
  clearError();
  const text = $("followUpMessage")?.value?.trim() || "";
  if (!vjaNextFollowUp || !text) return showError("There is no follow-up draft to copy.");
  try {
    await navigator.clipboard.writeText(text);
    const button = $("copyFollowUp");
    if (button) {
      button.textContent = "Copied ✓";
      setTimeout(() => { if (button) button.textContent = "Copy follow-up"; }, 1200);
    }
    $("followUpStatus").textContent = "Draft copied. Send it yourself through the recommended recruiter/ATS channel.";
  } catch (error) {
    showError(error?.message || String(error));
  }
}

async function vjaOpenFollowUpApplication() {
  clearError();
  const url = window.vjaFollowUpDesk?.safeHttpUrl?.(vjaNextFollowUp?.url) || "";
  if (!url) return showError("This follow-up does not have a safe HTTP/HTTPS application URL.");
  try {
    await chrome.tabs.create({ url, active: true });
    $("followUpStatus").textContent = "Application opened. The extension has not sent the follow-up.";
  } catch (error) {
    showError(error?.message || String(error));
  }
}

async function vjaMarkFollowUpSent() {
  clearError();
  if (!vjaNextFollowUp) return showError("There is no due follow-up to mark as sent.");
  const confirmed = window.confirm(
    "Only continue if you already sent this follow-up yourself.\n\nThis button does not send any message; it only records the follow-up in Job Search Assistant."
  );
  if (!confirmed) return;

  const request = window.vjaFollowUpDesk?.buildMarkSentRequest?.(
    vjaNextFollowUp.vacancyId,
    "Follow-up manually sent; recorded from Violetta Apply Assistant"
  );
  if (!request) return showError("Could not build a safe follow-up record request.");

  vjaSetFollowUpBusy(true);
  try {
    const api = await getApiBase();
    const response = await vjaFetch(`${api}${request.path}`, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body)
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || `Could not record the follow-up (${response.status}).`);
    }

    const previous = `${vjaNextFollowUp.title} at ${vjaNextFollowUp.company}`;
    await vjaLoadFollowUpDesk({ quiet: true });
    $("followUpStatus").textContent = `Recorded follow-up for ${previous}. The next due application, if any, is ready.`;
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    vjaSetFollowUpBusy(false);
  }
}

async function vjaOpenFullFollowUpDesk() {
  clearError();
  try {
    const api = await getApiBase();
    await chrome.tabs.create({ url: `${api}/followups.html`, active: true });
  } catch (error) {
    showError(error?.message || String(error));
  }
}

vjaEnsureFollowUpDeskUi();
setTimeout(() => {
  vjaLoadFollowUpDesk().catch(() => {});
}, 0);

window.vjaLoadFollowUpDesk = vjaLoadFollowUpDesk;
