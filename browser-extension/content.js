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

function detectCompany() {
  return firstText([
    "[data-qa='vacancy-company-name']",
    "[data-testid*='company']",
    "[class*='company-name']",
    "[class*='employer']",
    "h2"
  ]);
}

function detectTitle() {
  return firstText([
    "[data-qa='vacancy-title']",
    "h1",
    "[data-testid*='job-title']",
    "[class*='job-title']"
  ]) || document.title;
}

function detectDescription() {
  const targeted = firstText([
    "[data-qa='vacancy-description']",
    "[data-testid*='job-description']",
    "[class*='job-description']",
    "[class*='vacancy-description']",
    "main"
  ]);
  const raw = targeted || textOf(document.body);
  return raw.slice(0, 24000);
}

function extractPage() {
  const body = textOf(document.body).toLowerCase();
  const country = location.hostname.endsWith(".ru") || body.includes("россия") ? "Russia" : "";
  const remote = /remote|удален|удалён|work from home|home office/i.test(body);
  return {
    title: detectTitle(),
    company: detectCompany(),
    description: detectDescription(),
    country,
    location: "",
    remoteScope: remote ? "Remote detected on page" : "",
    experience: "",
    source: location.hostname.replace(/^www\./, ""),
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
  const near = el.parentElement?.querySelector("label, legend, [class*='label'], [class*='question']");
  if (near) parts.push(textOf(near));
  parts.push(el.getAttribute("aria-label") || "");
  parts.push(el.getAttribute("placeholder") || "");
  parts.push(el.getAttribute("name") || "");
  parts.push(el.id || "");
  return parts.join(" ").toLowerCase();
}

function setValue(el, value) {
  if (value == null || value === "") return false;
  if (el instanceof HTMLSelectElement) {
    const target = String(value).toLowerCase();
    const option = [...el.options].find(o =>
      o.value.toLowerCase() === target ||
      o.textContent.trim().toLowerCase() === target ||
      o.textContent.trim().toLowerCase().includes(target)
    );
    if (!option) return false;
    el.value = option.value;
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (["checkbox", "radio", "file", "submit", "button", "hidden"].includes(el.type)) return false;
    const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(el, value);
  } else {
    return false;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function chooseName(candidate, language) {
  if (language === "ru") return candidate.russianName || candidate.name;
  return candidate.name;
}

function fillApplication(candidate, draft) {
  const fullName = chooseName(candidate, draft.language);
  const latinName = candidate.name || "Violetta Nicolaou";
  const [firstName, ...lastParts] = latinName.split(/\s+/);
  const lastName = lastParts.join(" ");
  let filled = 0;

  const fields = [...document.querySelectorAll("input, textarea, select")]
    .filter(el => !el.disabled && !el.readOnly && el.offsetParent !== null);

  for (const el of fields) {
    if ((el.value || "").trim()) continue;
    const label = labelFor(el);
    let value = "";

    if (/first.?name|given.?name|имя(?! компании)/.test(label)) value = draft.language === "ru" ? "Виолетта" : firstName;
    else if (/last.?name|surname|family.?name|фамили/.test(label)) value = draft.language === "ru" ? "Николау" : lastName;
    else if (/full.?name|your.?name|фио|имя и фамилия/.test(label)) value = fullName;
    else if (/e-?mail|почт/.test(label)) value = candidate.email;
    else if (/github/.test(label)) value = candidate.gitHubUrl;
    else if (/portfolio|website|personal.?site|сайт|портфолио/.test(label)) value = candidate.cvUrl;
    else if (/city|город/.test(label)) value = candidate.currentCity;
    else if (/current.?location|location|местополож/.test(label)) value = `${candidate.currentCity}, ${candidate.currentCountry}`;
    else if (/cover.?letter|motivation.?letter|сопровод|мотивац/.test(label)) value = draft.coverLetter;
    else if (/why.*(role|position|company)|why.*interested|почему.*(ваканс|компан)|интерес.*ваканс/.test(label)) value = draft.shortMessage;
    else if (/linkedin/.test(label)) value = "";
    else if (/salary|compensation|зарплат|ожидани.*доход/.test(label)) value = "";
    else if (/start.?date|available.?from|дата выхода|когда.*начать/.test(label)) value = "";

    if (value && setValue(el, value)) filled++;
  }

  const yesNoControls = [...document.querySelectorAll("select, input[type='radio']")];
  for (const el of yesNoControls) {
    const label = labelFor(el);
    const wantsRussiaAuth = /authorized.*russia|right.*work.*russia|право.*работ.*росси/.test(label);
    const wantsEuAuth = /authorized.*(eu|europe)|right.*work.*(eu|europe)|право.*работ.*(ес|европ)/.test(label);
    const sponsorship = /require.*sponsor|need.*sponsor|visa sponsorship|спонсор.*виз/.test(label);
    const answer = wantsRussiaAuth ? candidate.russiaWorkAuthorized : wantsEuAuth ? candidate.euWorkAuthorized : sponsorship ? false : null;
    if (answer == null) continue;

    if (el instanceof HTMLSelectElement) {
      const desired = answer ? ["yes", "да"] : ["no", "нет"];
      const option = [...el.options].find(o => desired.some(x => o.textContent.trim().toLowerCase() === x || o.value.toLowerCase() === x));
      if (option) {
        el.value = option.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filled++;
      }
    } else if (el instanceof HTMLInputElement && el.type === "radio") {
      const own = labelFor(el);
      const shouldCheck = answer ? /yes|да/.test(own) : /no|нет/.test(own);
      if (shouldCheck && !el.checked) {
        el.click();
        filled++;
      }
    }
  }

  return { filled };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.type === "extractPage") sendResponse(extractPage());
    else if (message.type === "fillApplication") sendResponse(fillApplication(message.candidate, message.draft));
  } catch (error) {
    sendResponse({ error: error?.message || String(error), filled: 0 });
  }
  return true;
});
