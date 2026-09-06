let vjaPipelineRows = [];
let vjaPipelineSelected = null;

function vjaEnsurePipelineDeskUi() {
  let card = $("pipelineDeskCard");
  if (card) return card;

  const anchor = $("followUpDeskCard") || $("dailyLoopCard") || $("profileStatus");
  if (!anchor) return null;

  card = document.createElement("section");
  card.id = "pipelineDeskCard";
  card.className = "pipelineDeskCard";

  const head = document.createElement("div");
  head.className = "pipelineDeskHead";
  const identity = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "small";
  eyebrow.textContent = "Pipeline Desk · recruiter outcomes";
  const title = document.createElement("strong");
  title.id = "pipelineTitle";
  title.textContent = "Checking active applications…";
  identity.append(eyebrow, title);
  const badge = document.createElement("span");
  badge.id = "pipelineStageBadge";
  badge.className = "pipelineStageBadge";
  badge.textContent = "—";
  head.append(identity, badge);

  const meta = document.createElement("p");
  meta.id = "pipelineMeta";
  meta.className = "pipelineMeta";
  meta.textContent = "Record a stage only after you have actually received the recruiter update.";

  const applicationWrap = document.createElement("label");
  applicationWrap.textContent = "Active application";
  const application = document.createElement("select");
  application.id = "pipelineApplication";
  applicationWrap.append(application);

  const targetWrap = document.createElement("label");
  targetWrap.id = "pipelineTargetWrap";
  targetWrap.textContent = "New stage";
  const target = document.createElement("select");
  target.id = "pipelineTarget";
  targetWrap.append(target);

  const noteWrap = document.createElement("label");
  noteWrap.id = "pipelineNoteWrap";
  noteWrap.textContent = "Optional note";
  const note = document.createElement("input");
  note.id = "pipelineNote";
  note.type = "text";
  note.maxLength = 500;
  note.placeholder = "e.g. Recruiter invited me to HR interview";
  noteWrap.append(note);

  const actions = document.createElement("div");
  actions.className = "pipelineDeskActions";
  const open = document.createElement("button");
  open.id = "openPipelineJob";
  open.className = "secondary";
  open.textContent = "Open application";
  const analytics = document.createElement("button");
  analytics.id = "openOutcomeAnalytics";
  analytics.className = "secondary";
  analytics.textContent = "Outcome analytics";
  const record = document.createElement("button");
  record.id = "recordPipelineStage";
  record.className = "primary fullRow";
  record.textContent = "Record recruiter stage";
  actions.append(open, analytics, record);

  const status = document.createElement("p");
  status.id = "pipelineStatus";
  status.className = "pipelineDeskStatus";
  status.textContent = "Loading…";

  card.append(head, meta, applicationWrap, targetWrap, noteWrap, actions, status);
  anchor.insertAdjacentElement("afterend", card);

  application.addEventListener("change", () => vjaSelectPipelineApplication(application.value));
  open.addEventListener("click", vjaOpenPipelineApplication);
  analytics.addEventListener("click", vjaOpenOutcomeAnalytics);
  record.addEventListener("click", vjaRecordPipelineStage);
  return card;
}

function vjaSetPipelineBusy(busy) {
  for (const id of ["pipelineApplication", "pipelineTarget", "pipelineNote", "openPipelineJob", "openOutcomeAnalytics", "recordPipelineStage"]) {
    const node = $(id);
    if (node) node.disabled = busy;
  }
}

function vjaFormatPipelineDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "recently";
  }
}

function vjaRenderPipelineTargets(row) {
  const target = $("pipelineTarget");
  const record = $("recordPipelineStage");
  if (!target || !record) return;
  target.innerHTML = "";
  const targets = window.vjaPipelineDesk.allowedTargets(row?.status);
  for (const status of targets) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = window.vjaPipelineDesk.label(status);
    target.appendChild(option);
  }
  target.disabled = targets.length === 0;
  record.disabled = targets.length === 0;
}

function vjaSelectPipelineApplication(id) {
  const row = vjaPipelineRows.find(item => item.id === id) || vjaPipelineRows[0] || null;
  vjaPipelineSelected = row;
  const card = vjaEnsurePipelineDeskUi();
  if (!card) return;

  if (!row) {
    card.classList.add("isEmpty");
    $("pipelineTitle").textContent = "No active application pipeline yet";
    $("pipelineStageBadge").textContent = "Clear";
    $("pipelineMeta").textContent = "Applied and interview-stage vacancies will appear here after they are recorded in Job Search Assistant.";
    $("pipelineStatus").textContent = "Nothing to update right now.";
    return;
  }

  card.classList.remove("isEmpty");
  $("pipelineTitle").textContent = `${row.company} · ${row.title}`;
  $("pipelineStageBadge").textContent = window.vjaPipelineDesk.label(row.status);
  $("pipelineMeta").textContent = `Current CRM stage: ${window.vjaPipelineDesk.label(row.status)} · updated ${vjaFormatPipelineDate(row.updatedAt)}.`;
  if ($("pipelineApplication")) $("pipelineApplication").value = row.id;
  if ($("pipelineNote")) $("pipelineNote").value = "";
  vjaRenderPipelineTargets(row);
  $("openPipelineJob").disabled = !row.url;
  $("pipelineStatus").textContent = row.status === "Offer"
    ? "Offer is terminal in the compact desk. Use the full dashboard only if an exceptional correction is needed."
    : "Choose the stage that actually happened. The extension never infers recruiter outcomes from messages.";
}

function vjaRenderPipelineList(rows, preferredId = "") {
  const card = vjaEnsurePipelineDeskUi();
  const select = $("pipelineApplication");
  if (!card || !select) return;
  vjaPipelineRows = rows;
  select.innerHTML = "";

  if (!rows.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No active applications";
    select.appendChild(option);
    select.disabled = true;
    vjaSelectPipelineApplication("");
    return;
  }

  select.disabled = false;
  for (const row of rows) {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = `${row.company} — ${row.title} (${window.vjaPipelineDesk.label(row.status)})`;
    select.appendChild(option);
  }

  const chosen = rows.some(row => row.id === preferredId) ? preferredId : rows[0].id;
  select.value = chosen;
  vjaSelectPipelineApplication(chosen);
}

async function vjaLoadPipelineDesk({ quiet = false, preferredId = "" } = {}) {
  vjaEnsurePipelineDeskUi();
  if (!window.vjaPipelineDesk) return [];
  const preserve = preferredId || vjaPipelineSelected?.id || "";
  if (!quiet) {
    $("pipelineStatus").textContent = "Checking active pipeline…";
    vjaSetPipelineBusy(true);
  }

  try {
    const api = await getApiBase();
    const response = await fetch(`${api}/api/dashboard`);
    if (!response.ok) throw new Error(`Dashboard returned ${response.status}.`);
    const payload = await response.json();
    const rows = window.vjaPipelineDesk.normalizePipeline(payload?.pipeline || [], 15);
    vjaRenderPipelineList(rows, preserve);
    return rows;
  } catch (error) {
    vjaPipelineRows = [];
    vjaPipelineSelected = null;
    const card = vjaEnsurePipelineDeskUi();
    if (card) card.classList.add("isEmpty");
    $("pipelineTitle").textContent = "Pipeline unavailable";
    $("pipelineStageBadge").textContent = "—";
    $("pipelineMeta").textContent = error?.message || String(error);
    $("pipelineStatus").textContent = "Application preparation and follow-up controls remain available.";
    return [];
  } finally {
    vjaSetPipelineBusy(false);
    if (vjaPipelineSelected) {
      vjaRenderPipelineTargets(vjaPipelineSelected);
      $("openPipelineJob").disabled = !vjaPipelineSelected.url;
    }
  }
}

async function vjaRecordPipelineStage() {
  clearError();
  const row = vjaPipelineSelected;
  const target = $("pipelineTarget")?.value || "";
  if (!row || !target) return showError("Choose an active application and a valid new stage first.");

  const targetLabel = window.vjaPipelineDesk.label(target);
  const confirmed = window.confirm(
    `Record “${targetLabel}” for ${row.title} at ${row.company}?\n\nThis only updates Job Search Assistant. It does not reply to the recruiter or change anything on the employer site.`
  );
  if (!confirmed) return;

  const request = window.vjaPipelineDesk.buildStatusRequest(
    row.id,
    row.status,
    target,
    $("pipelineNote")?.value || ""
  );
  if (!request) return showError("That compact pipeline transition is not allowed. Use the full dashboard for exceptional corrections.");

  vjaSetPipelineBusy(true);
  try {
    const api = await getApiBase();
    const response = await fetch(`${api}${request.path}`, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body)
    });
    if (!response.ok) throw new Error(`Could not update the pipeline (${response.status}).`);

    await vjaLoadPipelineDesk({ quiet: true, preferredId: row.id });
    await window.vjaLoadFollowUpDesk?.({ quiet: true });
    $("pipelineStatus").textContent = `Recorded ${targetLabel} for ${row.company}. Outcome analytics and follow-up eligibility now use the new stage.`;
  } catch (error) {
    showError(error?.message || String(error));
  } finally {
    vjaSetPipelineBusy(false);
    if (vjaPipelineSelected) {
      vjaRenderPipelineTargets(vjaPipelineSelected);
      $("openPipelineJob").disabled = !vjaPipelineSelected.url;
    }
  }
}

async function vjaOpenPipelineApplication() {
  clearError();
  const url = window.vjaPipelineDesk?.safeHttpUrl?.(vjaPipelineSelected?.url) || "";
  if (!url) return showError("This application does not have a safe HTTP/HTTPS vacancy URL.");
  try {
    await chrome.tabs.create({ url, active: true });
  } catch (error) {
    showError(error?.message || String(error));
  }
}

async function vjaOpenOutcomeAnalytics() {
  clearError();
  try {
    const api = await getApiBase();
    await chrome.tabs.create({ url: `${api}/analytics.html`, active: true });
  } catch (error) {
    showError(error?.message || String(error));
  }
}

vjaEnsurePipelineDeskUi();
setTimeout(() => {
  vjaLoadPipelineDesk().catch(() => {});
}, 0);

window.vjaLoadPipelineDesk = vjaLoadPipelineDesk;
