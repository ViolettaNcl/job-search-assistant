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
  return window.vjaAtsStructured?.detectAtsHost?.(location.hostname) || "generic";
}

const atsSelectors = {
  hh: {
    title: ["[data-qa='vacancy-title']", "h1"],
    company: ["[data-qa='vacancy-company-name']", "[data-qa='vacancy-company-name'] a"],
    description: ["[data-qa='vacancy-description']"],
    location: ["[data-qa='vacancy-view-raw-address']", "[data-qa='vacancy-view-location']"]
  },
  greenhouse: {
    title: ["h1.app-title", "h1", "[class*='job-title']", "[data-testid*='job-title']"],
    company: [".company-name", "[class*='company-name']", "header img[alt]", "[data-testid*='company']"],
    description: ["#content", ".job__description", "[class*='job-description']", "[data-testid*='job-description']", "main"],
    location: [".location", "[class*='location']", "[data-testid*='location']"]
  },
  lever: {
    title: [".posting-headline h2", ".posting-headline h1", "[data-qa='posting-name']", "h2", "h1"],
    company: [".main-header-logo img[alt]", "[class*='company']", "header img[alt]"],
    description: [".posting-page .content", ".posting-page .section-wrapper", ".posting", "main"],
    location: [".posting-categories .location", ".posting-headline .location", ".location"]
  },
  ashby: {
    title: ["[data-testid*='job-title']", "[class*='jobTitle']", "h1"],
    company: ["[data-testid*='company']", "[class*='company']", "header img[alt]"],
    description: ["[data-testid='job-description']", "[class*='jobDescription']", "[data-testid*='description']", "main"],
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
  const structured = window.vjaAtsStructured?.readStructuredJobPosting?.(document) || null;
  const bodyRaw = textOf(document.body);
  const body = bodyRaw.toLowerCase();
  const locationText = structured?.location || detectLocation(ats);
  const country = structured?.country || inferCountry(ats, locationText, bodyRaw);
  const remoteOnPage = /remote|удален|удалён|work from home|home office|fully distributed/i.test(body);
  const remote = Boolean(structured?.remote || remoteOnPage);
  return {
    title: structured?.title || detectTitle(ats),
    company: structured?.company || detectCompany(ats),
    description: structured?.description || detectDescription(ats),
    country,
    location: locationText,
    remoteScope: remote ? (structured?.remote ? "Remote detected in structured job data" : "Remote detected on page") : "",
    experience: structured?.experience || "",
    source: location.hostname.replace(/^www\./, ""),
    ats,
    remote,
    url: location.href
  };
}

function textByIds(value) {
  return String(value || "")
    .split(/\s+/)
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .map(textOf)
    .filter(Boolean)
    .join(" ");
}

function associatedLabel(el) {
  if (!el?.id) return null;
  try {
    return document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
  } catch {
    return null;
  }
}

function groupContext(el) {
  const parts = [];
  const fieldset = el.closest?.("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (legend) parts.push(textOf(legend));

  const group = el.closest?.("[role='radiogroup'], [role='group'], [class*='question'], [class*='field']");
  if (group && group !== el) {
    const labelled = textByIds(group.getAttribute?.("aria-labelledby"));
    if (labelled) parts.push(labelled);
    const heading = group.querySelector?.("legend, [class*='label'], [class*='question-title'], [data-testid*='label']");
    if (heading) parts.push(textOf(heading));
  }
  return parts.filter(Boolean);
}

function labelFor(el) {
  const parts = [];
  const explicit = associatedLabel(el);
  if (explicit) parts.push(textOf(explicit));

  const parentLabel = el.closest?.("label");
  if (parentLabel) parts.push(textOf(parentLabel));

  parts.push(...groupContext(el));

  const labelled = textByIds(el.getAttribute?.("aria-labelledby"));
  if (labelled) parts.push(labelled);

  const described = textByIds(el.getAttribute?.("aria-describedby"));
  if (described && described.length < 500) parts.push(described);

  const near = el.parentElement?.querySelector?.("label, legend, [class*='label'], [class*='question']");
  if (near) parts.push(textOf(near));

  parts.push(el.getAttribute?.("aria-label") || "");
  parts.push(el.getAttribute?.("placeholder") || "");
  parts.push(el.getAttribute?.("name") || "");
  parts.push(el.id || "");
  parts.push(el.getAttribute?.("data-testid") || "");
  return [...new Set(parts.map(x => String(x || "").trim()).filter(Boolean))].join(" ").trim().slice(0, 1200);
}

function isActuallyVisible(el) {
  if (el.offsetParent !== null) return true;
  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
    const label = associatedLabel(el) || el.closest("label");
    return Boolean(label && label.offsetParent !== null);
  }
  return false;
}

function elementMeta(el) {
  return {
    tagName: el.tagName || "",
    role: el.getAttribute?.("role") || "",
    ariaHasPopup: el.getAttribute?.("aria-haspopup") || ""
  };
}

function customFieldType(el) {
  return window.vjaAtsControls?.classifyElementMeta?.(elementMeta(el)) || "";
}

function visibleFields() {
  const selector = "input, textarea, select, [role='combobox'], [role='radiogroup'], button[aria-haspopup='listbox'], [role='button'][aria-haspopup='listbox']";
  return [...document.querySelectorAll(selector)]
    .filter((el, index, all) => all.indexOf(el) === index)
    .filter(el => {
      if (el.disabled || el.readOnly || el.getAttribute?.("aria-disabled") === "true") return false;
      if (el instanceof HTMLInputElement && ["hidden", "submit", "button", "reset", "image"].includes(el.type)) return false;
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox") && el.closest("[role='radiogroup']")) return false;
      return isActuallyVisible(el);
    });
}

function ensureToken(el, index) {
  if (!el.dataset.vjaFieldToken) el.dataset.vjaFieldToken = `vja-${Date.now()}-${index}`;
  return el.dataset.vjaFieldToken;
}

function fieldTypeFor(el) {
  const custom = customFieldType(el);
  if (custom) return custom;
  const role = (el.getAttribute?.("role") || "").toLowerCase();
  const ariaAutocomplete = (el.getAttribute?.("aria-autocomplete") || "").toLowerCase();
  if (role === "combobox" || (ariaAutocomplete && ariaAutocomplete !== "none")) return "combobox";
  if (el instanceof HTMLSelectElement) return el.multiple ? "multiselect" : "select";
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLInputElement) return el.type || "text";
  return role || "custom";
}

function currentValue(el) {
  const type = fieldTypeFor(el);
  if (type === "radiogroup") {
    const selected = el.querySelector?.("[role='radio'][aria-checked='true']");
    return selected ? textOf(selected) : "";
  }
  if (type === "combobox") {
    if (el instanceof HTMLInputElement) return String(el.value || "").trim();
    return String(el.getAttribute?.("aria-valuetext") || el.getAttribute?.("data-value") || "").trim();
  }
  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
    return el.checked ? (el.value || "checked") : "";
  }
  if ("value" in el) return String(el.value || "").trim();
  return String(el.getAttribute?.("aria-valuetext") || "").trim();
}

function customOptions(el, type) {
  if (type !== "radiogroup") return null;
  const options = [...el.querySelectorAll?.("[role='radio']") || []].map(textOf).filter(Boolean);
  return options.length ? [...new Set(options)] : null;
}

function scanFields() {
  const fields = visibleFields().map((el, index) => {
    const token = ensureToken(el, index);
    const type = fieldTypeFor(el);
    const options = el instanceof HTMLSelectElement
      ? [...el.options].map(o => (o.textContent || o.value || "").trim()).filter(Boolean)
      : customOptions(el, type);
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
  el.dispatchEvent(new Event("blur", { bubbles: true }));
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
    return target.length > 2 && (text.includes(target) || raw.includes(target));
  });
  if (!option) return false;
  el.value = option.value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
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
  if (value == null || value === "") return false;
  if (window.vjaAtsControls?.isInteractiveReviewType?.(fieldTypeFor(el))) return false;
  if (el instanceof HTMLInputElement && el.type === "file") return false;
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
  const inputs = [...document.querySelectorAll("input[type='file']")].filter(el => !el.disabled);
  if (!inputs.length) return { found: false };
  const first = inputs.find(isActuallyVisible) || inputs[0];
  first.style.outline = "3px solid #2563eb";
  first.style.outlineOffset = "3px";
  const target = associatedLabel(first) || first.closest("label") || first;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  const label = first.closest("label") || associatedLabel(first);
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
