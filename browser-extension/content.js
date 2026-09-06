function textOf(el) {
  return (el?.innerText || el?.textContent || "").trim();
}

function firstText(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const value = textOf(el);
    if (value) return value;
  }
  return "";
}

function detectAts() {
  const host = location.hostname.toLowerCase();
  if (/(^|\.)hh\.ru$/.test(host)) return "hh";
  if (host.includes("greenhouse.io")) return "greenhouse";
  if (host.includes("lever.co")) return "lever";
  if (host.includes("ashbyhq.com")) return "ashby";
  return "generic";
}

const atsSelectors = {
  hh: {
    title: ["[data-qa='vacancy-title']", "h1"],
    company: ["[data-qa='vacancy-company-name']", "[data-qa='vacancy-company-name'] a"],
    description: ["[data-qa='vacancy-description']"],
    location: ["[data-qa='vacancy-view-raw-address']", "[data-qa='vacancy-view-location']"]
  },
  greenhouse: {
    title: ["h1.app-title", "h1", "[class*='job-title']"],
    company: [".company-name", "[class*='company-name']", "header img[alt]"],
    description: ["#content", ".job__description", "[class*='job-description']", "main"],
    location: [".location", "[class*='location']"]
  },
  lever: {
    title: [".posting-headline h2", "h2", "h1"],
    company: [".main-header-logo img[alt]", "[class*='company']"],
    description: [".posting-page .content", ".posting", "main"],
    location: [".posting-categories .location", ".location"]
  },
  ashby: {
    title: ["h1", "[data-testid*='job-title']", "[class*='jobTitle']"],
    company: ["[data-testid*='company']", "[class*='company']"],
    description: ["[data-testid='job-description']", "[class*='jobDescription']", "main"],
    location: ["[data-testid*='location']", "[class*='location']"]
  },
  generic: {
    title: ["h1", "[data-testid*='job-title']", "[class*='job-title']"],
    company: ["[data-testid*='company']", "[class*='company-name']", "[class*='employer']", "h2"],
    description: ["[data-testid*='job-description']", "[class*='job-description']", "[class*='vacancy-description']", "main"],
    location: ["[data-testid*='location']", "[class*='location']"]
  }
};

function selectorsFor(kind, key) {
  return atsSelectors[kind]?.[key] || atsSelectors.generic[key];
}

function detectCompany(ats) {
  for (const selector of selectorsFor(ats, "company")) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const value = textOf(el) || el.getAttribute?.("alt") || "";
    if (value) return value.trim();
  }
  return "";
}

function detectTitle(ats) {
  return firstText(selectorsFor(ats, "title")) || document.title;
}

function detectDescription(ats) {
  const targeted = firstText(selectorsFor(ats, "description"));
  const raw = targeted || textOf(document.body);
  return raw.slice(0, 28000);
}

function detectLocation(ats) {
  return firstText(selectorsFor(ats, "location"));
}

function inferCountry(ats, locationText, bodyText) {
  if (ats === "hh" || location.hostname.endsWith(".ru") || /\bроссия\b/i.test(bodyText)) return "Russia";
  const haystack = `${locationText} ${bodyText.slice(0, 5000)}`.toLowerCase();
  const countries = [
    ["Cyprus", ["cyprus", "κύπρος", "кипр"]],
    ["Greece", ["greece", "athens", "thessaloniki", "ελλάδα"]],
    ["Poland", ["poland", "warsaw", "wroclaw", "krakow", "polska"]],
    ["Germany", ["germany", "berlin", "munich", "deutschland"]],
    ["Netherlands", ["netherlands", "amsterdam"]],
    ["Portugal", ["portugal", "lisbon", "porto"]],
    ["Spain", ["spain", "madrid", "barcelona"]],
    ["Ireland", ["ireland", "dublin"]],
    ["Romania", ["romania", "bucharest"]],
    ["Bulgaria", ["bulgaria", "sofia"]],
    ["Malta", ["malta"]],
    ["Estonia", ["estonia", "tallinn"]],
    ["Latvia", ["latvia", "riga"]],
    ["Lithuania", ["lithuania", "vilnius"]],
    ["Czech Republic", ["czech", "prague", "praha"]]
  ];
  for (const [country, needles] of countries) {
    if (needles.some(x => haystack.includes(x))) return country;
  }
  if (/\beu\b|european union|europe remote|remote europe|emea/.test(haystack)) return "EU";
  return "";
}

function extractPage() {
  const ats = detectAts();
  const bodyRaw = textOf(document.body);
  const body = bodyRaw.toLowerCase();
  const locationText = detectLocation(ats);
  const country = inferCountry(ats, locationText, bodyRaw);
  const remote = /remote|удален|удалён|work from home|home office|fully distributed/i.test(body);
  return {
    title: detectTitle(ats),
    company: detectCompany(ats),
    description: detectDescription(ats),
    country,
    location: locationText,
    remoteScope: remote ? "Remote detected on page" : "",
    experience: "",
    source: location.hostname.replace(/^www\./, ""),
    ats,
    remote,
    url: location.href
  };
}

function labelFor(el) {
  const parts = [];
  const id = el.id;
  if (id) {
    try {
      const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (explicit) parts.push(textOf(explicit));
    } catch { }
  }
  const parentLabel = el.closest("label");
  if (parentLabel) parts.push(textOf(parentLabel));
  const fieldset = el.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (legend) parts.push(textOf(legend));
  const near = el.parentElement?.querySelector("label, legend, [class*='label'], [class*='question']");
  if (near) parts.push(textOf(near));
  parts.push(el.getAttribute("aria-label") || "");
  parts.push(el.getAttribute("placeholder") || "");
  parts.push(el.getAttribute("name") || "");
  parts.push(el.id || "");
  return [...new Set(parts.filter(Boolean))].join(" ").trim();
}

function visibleFields() {
  return [...document.querySelectorAll("input, textarea, select")]
    .filter(el => !el.disabled && !el.readOnly && el.type !== "hidden" && el.type !== "submit" && el.type !== "button" && el.offsetParent !== null);
}

function ensureToken(el, index) {
  if (!el.dataset.vjaFieldToken) el.dataset.vjaFieldToken = `vja-${Date.now()}-${index}`;
  return el.dataset.vjaFieldToken;
}

function currentValue(el) {
  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
    return el.checked ? (el.value || "checked") : "";
  }
  return String(el.value || "").trim();
}

function scanFields() {
  const fields = visibleFields().map((el, index) => {
    const token = ensureToken(el, index);
    const type = el instanceof HTMLSelectElement ? "select" : el instanceof HTMLTextAreaElement ? "textarea" : el.type || "text";
    const options = el instanceof HTMLSelectElement
      ? [...el.options].map(o => (o.textContent || o.value || "").trim()).filter(Boolean)
      : null;
    return {
      token,
      label: labelFor(el),
      type,
      currentValue: currentValue(el),
      options
    };
  });
  return {
    ats: detectAts(),
    fields,
    uploadFields: fields.filter(x => x.type === "file").length
  };
}

function setTextValue(el, value) {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(el, value) {
  const target = String(value).trim().toLowerCase();
  const yes = /^(yes|да|true)$/i.test(target);
  const no = /^(no|нет|false)$/i.test(target);
  const option = [...el.options].find(o => {
    const text = (o.textContent || "").trim().toLowerCase();
    const raw = String(o.value || "").trim().toLowerCase();
    if (text === target || raw === target) return true;
    if (yes && ["yes", "да", "true"].includes(text)) return true;
    if (no && ["no", "нет", "false"].includes(text)) return true;
    return target.length > 2 && text.includes(target);
  });
  if (!option) return false;
  el.value = option.value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setRadioOrCheckbox(el, value) {
  const desired = String(value).trim().toLowerCase();
  const own = `${el.value || ""} ${labelFor(el)}`.toLowerCase();
  const wantsYes = /^(yes|да|true)$/i.test(desired);
  const wantsNo = /^(no|нет|false)$/i.test(desired);
  const matches = wantsYes ? /\byes\b|\bда\b|true/.test(own) : wantsNo ? /\bno\b|\bнет\b|false/.test(own) : own.includes(desired);
  if (!matches) return false;
  if (!el.checked) el.click();
  return true;
}

function setFieldValue(el, value) {
  if (value == null || value === "" || el.type === "file") return false;
  if (el instanceof HTMLSelectElement) return setSelectValue(el, value);
  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) return setRadioOrCheckbox(el, value);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setTextValue(el, value);
    return true;
  }
  return false;
}

function applyFieldPlan(resolutions) {
  let filled = 0;
  let skippedExisting = 0;
  const review = [];
  const blocked = [];

  for (const item of resolutions || []) {
    const el = document.querySelector(`[data-vja-field-token="${CSS.escape(item.token)}"]`);
    if (!el) continue;
    if (item.action === "blocked") {
      blocked.push(item);
      continue;
    }
    if (item.action === "review") {
      review.push(item);
      continue;
    }
    if (item.action !== "fill") continue;
    if (currentValue(el) && !(el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox"))) {
      skippedExisting++;
      continue;
    }
    if (setFieldValue(el, item.value)) filled++;
  }

  return { filled, skippedExisting, review: review.length, blocked: blocked.length };
}

function collectRememberable(resolutions) {
  const values = {};
  for (const item of resolutions || []) {
    if (!item.canRemember || !item.memoryKey) continue;
    const el = document.querySelector(`[data-vja-field-token="${CSS.escape(item.token)}"]`);
    if (!el) continue;
    const value = currentValue(el);
    if (value) values[item.memoryKey] = value;
  }
  return values;
}

function inspectUploads() {
  const inputs = visibleFields().filter(el => el instanceof HTMLInputElement && el.type === "file");
  return { count: inputs.length };
}

function highlightCvUpload(filename) {
  const inputs = visibleFields().filter(el => el instanceof HTMLInputElement && el.type === "file");
  if (!inputs.length) return { found: false };
  const first = inputs[0];
  first.style.outline = "3px solid #2563eb";
  first.style.outlineOffset = "3px";
  first.scrollIntoView({ behavior: "smooth", block: "center" });
  const label = first.closest("label") || document.querySelector(`label[for="${CSS.escape(first.id || "")}"]`);
  if (label && filename) label.title = `Recommended CV: ${filename}`;
  return { found: true, count: inputs.length, filename };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.type === "extractPage") sendResponse(extractPage());
    else if (message.type === "scanFields") sendResponse(scanFields());
    else if (message.type === "applyFieldPlan") sendResponse(applyFieldPlan(message.resolutions));
    else if (message.type === "collectRememberable") sendResponse(collectRememberable(message.resolutions));
    else if (message.type === "inspectUploads") sendResponse(inspectUploads());
    else if (message.type === "highlightCvUpload") sendResponse(highlightCvUpload(message.filename));
  } catch (error) {
    sendResponse({ error: error?.message || String(error), filled: 0 });
  }
  return true;
});
