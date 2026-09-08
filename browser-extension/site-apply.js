(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaSiteApply = api;
})(typeof window !== "undefined" ? window : null, function () {
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function safeUrl(value) {
    try { return new URL(String(value || "")); }
    catch { return null; }
  }

  function isHhUrl(value) {
    const parsed = safeUrl(value);
    const host = (parsed?.hostname || "").toLowerCase();
    return host === "hh.ru" || host.endsWith(".hh.ru");
  }

  function sameJobUrl(left, right) {
    const a = safeUrl(left);
    const b = safeUrl(right);
    if (!a || !b) return false;
    const aHh = isHhUrl(a.href);
    const bHh = isHhUrl(b.href);
    if (aHh || bHh) {
      if (!aHh || !bHh) return false;
      const aId = a.pathname.match(/\/vacancy\/(\d+)/i)?.[1] || a.searchParams.get("vacancyId") || "";
      const bId = b.pathname.match(/\/vacancy\/(\d+)/i)?.[1] || b.searchParams.get("vacancyId") || "";
      return Boolean(aId && aId === bId);
    }
    return a.origin === b.origin && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
  }

  function hostFamily(value) {
    const parsed = safeUrl(value);
    const host = (parsed?.hostname || "").toLowerCase();
    return ["myworkdayjobs.com", "smartrecruiters.com", "greenhouse.io", "lever.co", "ashbyhq.com", "teamtailor.com", "recruitee.com", "workable.com", "personio.de", "personio.com"]
      .find(domain => host === domain || host.endsWith(`.${domain}`)) || host;
  }

  function tenantKey(value) {
    const parsed = safeUrl(value);
    if (!parsed) return "";
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    const workday = host.match(/^([^.]+)\.wd\d+\.myworkdayjobs\.com$/);
    if (workday) return `workday:${workday[1].toLowerCase()}`;
    if (host === "jobs.smartrecruiters.com") {
      const companyIndex = parts.findIndex(x => x.toLowerCase() === "company");
      const tenant = companyIndex >= 0 ? parts[companyIndex + 1] : parts[0];
      return tenant ? `smartrecruiters:${tenant.toLowerCase()}` : "";
    }
    const shared = new Map([
      ["boards.greenhouse.io", "greenhouse"], ["job-boards.greenhouse.io", "greenhouse"],
      ["jobs.lever.co", "lever"], ["jobs.ashbyhq.com", "ashby"], ["apply.workable.com", "workable"]
    ]);
    if (shared.has(host) && parts[0]) return `${shared.get(host)}:${parts[0].toLowerCase()}`;
    for (const domain of ["teamtailor.com", "recruitee.com", "personio.de", "personio.com"]) {
      if (host.endsWith(`.${domain}`)) return `${domain}:${host.slice(0, -(domain.length + 1)).split(".")[0]}`;
    }
    return "";
  }

  function isApplicationLike(value) {
    const parsed = safeUrl(value);
    if (!parsed) return false;
    const route = `${parsed.pathname} ${parsed.search}`.toLowerCase();
    return /apply|application|candidate|questionnaire|screening|respond|negotiation|oneclick-ui|thank-?you|submitted|confirmation/.test(route);
  }

  function titleMatches(expectedTitle, pageText) {
    const expected = clean(expectedTitle).toLowerCase();
    const current = clean(pageText).toLowerCase();
    if (!expected || !current) return false;
    if (current.includes(expected)) return true;
    const tokens = [...new Set(expected.split(/[^\p{L}\p{N}#+.]+/u).filter(x => x.length >= 3 && !/^(jobs?|career|apply|vacancy|software|developer)$/.test(x)))];
    return tokens.length >= 2 && tokens.filter(token => current.includes(token)).length / tokens.length >= 0.8;
  }

  function canResume(input = {}) {
    const source = safeUrl(input.sourceUrl);
    const current = safeUrl(input.currentUrl);
    if (!source || !current) return { ok: false, reason: "invalid-route" };
    if (isHhUrl(source.href) && isHhUrl(current.href) && sameJobUrl(source.href, current.href)) {
      return titleMatches(input.jobTitle, input.pageText)
        ? { ok: true, reason: "same-hh-vacancy" }
        : { ok: false, reason: "different-job" };
    }
    if (!isApplicationLike(current)) return { ok: false, reason: "invalid-route" };
    const sourceFamily = hostFamily(source);
    const currentFamily = hostFamily(current);
    if (!sourceFamily || sourceFamily !== currentFamily) return { ok: false, reason: "different-host-family" };
    const sharedFamily = ["myworkdayjobs.com", "smartrecruiters.com", "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com"].includes(sourceFamily);
    if (sharedFamily && (!tenantKey(source) || tenantKey(source) !== tenantKey(current))) return { ok: false, reason: "different-ats-tenant" };
    if (!sharedFamily && source.origin !== current.origin) return { ok: false, reason: "different-origin" };
    if (!titleMatches(input.jobTitle, input.pageText)) return { ok: false, reason: "different-job" };
    return { ok: true, reason: "same-job" };
  }

  function canAcceptReceipt(input = {}) {
    return Boolean(input.finalClicked && input.receiptConfirmed);
  }

  function scoreStartAction(label, metadata = {}) {
    const text = clean(label).toLowerCase();
    if (!text) return -100;
    if (/sign in|log in|register|subscribe|save|bookmark|share|войти|регистрац|сохранить|подпис/i.test(text)) return -100;
    if (/submit application|send application|complete application|отправить (заявку|отклик)|подать (заявку|отклик)/i.test(text)) {
      return metadata.inForm || metadata.inDialog ? -100 : 5;
    }

    let score = -100;
    if (/^откликнуться$/i.test(text)) score = 14;
    else if (/откликнуться|отклик на вакансию|respond to (this )?(job|vacancy)/i.test(text)) score = 12;
    else if (/^apply now$|^apply$|apply for (this )?(job|position)/i.test(text)) score = 11;
    else if (/отправить резюме|send (my )?cv|send (my )?resume/i.test(text)) score = 10;
    if (score < 0) return score;

    if (metadata.inForm || metadata.inDialog) score -= 5;
    const href = clean(metadata.href).toLowerCase();
    if (/apply|response|respond|negotiation|vacancy/.test(href)) score += 2;
    if (metadata.currentJob) score += 5;
    if (metadata.primary) score += 1;
    return score;
  }

  function chooseStartAction(candidates = []) {
    const ranked = candidates
      .map((item, index) => ({ ...item, index, score: scoreStartAction(item?.label, item?.metadata) }))
      .filter(item => item.score >= 8)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (!ranked.length) return { found: false, ambiguous: false, count: 0 };
    const bestScore = ranked[0].score;
    const ties = ranked.filter(item => item.score === bestScore);
    if (ties.length !== 1) {
      const fingerprints = ties.map(item => {
        const label = clean(item.label).toLowerCase();
        const href = clean(item.metadata?.href);
        if (!href) return "";
        try {
          const parsed = new URL(href, "https://placeholder.invalid");
          parsed.hash = "";
          return `${label}|${parsed.pathname}${parsed.search}`;
        } catch {
          return `${label}|${href}`;
        }
      });
      const equivalent = fingerprints[0] && fingerprints.every(value => value === fingerprints[0]);
      if (equivalent) {
        return { found: true, ambiguous: false, count: ties.length, candidate: ties[0], equivalentDuplicates: true };
      }
      return { found: false, ambiguous: true, count: ties.length, labels: ties.slice(0, 4).map(x => clean(x.label)) };
    }
    return { found: true, ambiguous: false, count: 1, candidate: ties[0] };
  }

  function chooseHhCoverLetterAction(candidates = []) {
    const matches = candidates
      .map((item, index) => ({ ...item, index, label: clean(item?.label) }))
      .filter(item => /^(?:(?:приложить|добавить) сопроводительное письмо|add (?:a )?cover letter)(?:\s|$)/i.test(item.label));
    if (!matches.length) return { found: false, ambiguous: false, count: 0 };
    if (matches.length > 1) {
      const normalized = matches.map(item => clean(item.label).toLowerCase());
      if (normalized.every(label => label === normalized[0])) {
        return { found: true, ambiguous: false, count: matches.length, candidate: matches[0], equivalentDuplicates: true };
      }
      return { found: false, ambiguous: true, count: matches.length };
    }
    return { found: true, ambiguous: false, count: 1, candidate: matches[0] };
  }

  function isApplicationContainerText(value, isHh = false) {
    const text = clean(value);
    if (isHh) return /выберите резюме|резюме для отклика|сопроводительное письмо|отправить отклик|откликнуться/i.test(text);
    return /apply|application|resume|cv|cover letter|отклик|резюме|сопровод|отправить/i.test(text);
  }

  function startReceiptDisposition(input = {}) {
    if (input.isHh && input.coverLetterRequired && input.coverLetterActionFound) return "attach-cover-letter";
    if (!input.receiptConfirmed) return "continue";
    if (input.isHh && input.coverLetterRequired) return "attach-cover-letter";
    return "accept";
  }

  function scoreCoverLetterField(label, metadata = {}) {
    const text = clean(label).toLowerCase();
    if (/salary|зарплат|password|парол|phone|телефон|email|e-mail|linkedin|legal|право|citizenship|граждан/i.test(text)) return -100;
    let score = 0;
    if (/сопровод|мотивацион|cover letter|motivation letter/i.test(text)) score += 14;
    else if (/message to|message for|сообщение работодател|письмо работодател/i.test(text)) score += 11;
    else if (/message|comment|комментар|письмо/i.test(text)) score += 7;
    if (metadata.textarea) score += 3;
    if (metadata.required) score += 1;
    return score;
  }

  function chooseCoverLetterField(candidates = []) {
    const ranked = candidates
      .map((item, index) => ({ ...item, index, score: scoreCoverLetterField(item?.label, item?.metadata) }))
      .filter(item => item.score >= 7)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (!ranked.length) return { found: false, ambiguous: false, count: 0 };
    const bestScore = ranked[0].score;
    const ties = ranked.filter(item => item.score === bestScore);
    if (ties.length !== 1) return { found: false, ambiguous: true, count: ties.length };
    return { found: true, ambiguous: false, count: 1, candidate: ties[0] };
  }

  function normalizeResumeHint(value) {
    return clean(value).toLowerCase().replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
  }

  function chooseHhResumeChoice(candidates = [], preferredLabel = "") {
    const usable = candidates.filter(item => item && !item.metadata?.disabled);
    if (!usable.length) return { found: false, ambiguous: false, count: 0 };

    const selected = usable.filter(item => item.metadata?.selected === true);
    if (selected.length === 1) return { found: true, ambiguous: false, count: 1, candidate: selected[0], reason: "already-selected" };
    if (selected.length > 1) return { found: false, ambiguous: true, count: selected.length, reason: "multiple-selected" };
    if (usable.length === 1) return { found: true, ambiguous: false, count: 1, candidate: usable[0], reason: "single-resume" };

    const preferred = normalizeResumeHint(preferredLabel);
    if (preferred) {
      const preferredTokens = preferred.split(/\s+/).filter(token => token.length >= 3);
      const ranked = usable.map((item, index) => {
        const label = normalizeResumeHint(item.label);
        let score = label === preferred ? 100 : 0;
        if (!score && label && (label.includes(preferred) || preferred.includes(label))) score = 70;
        if (!score && preferredTokens.length) {
          const matches = preferredTokens.filter(token => label.includes(token)).length;
          score = Math.round(50 * (matches / preferredTokens.length));
        }
        return { ...item, index, score };
      }).sort((a, b) => b.score - a.score || a.index - b.index);
      const best = ranked[0];
      const ties = ranked.filter(item => item.score === best.score);
      if (best.score >= 35 && ties.length === 1) return { found: true, ambiguous: false, count: 1, candidate: best, reason: "preferred-match" };
    }

    return { found: false, ambiguous: true, count: usable.length, labels: usable.slice(0, 5).map(item => clean(item.label)), reason: "resume-choice-required" };
  }

  function unresolvedRequired(fields = []) {
    const checkedRadioGroups = new Set(fields.filter(field => field?.type === "radio" && field.checked).map(field => clean(field.group)));
    return fields.filter(field => {
      if (!field?.required || field.disabled || field.hidden) return false;
      if (field.type === "radio") return !field.checked && !checkedRadioGroups.has(clean(field.group));
      if (field.type === "checkbox") return !field.checked;
      if (field.type === "file") return Number(field.fileCount || 0) < 1;
      return !clean(field.value);
    });
  }

  function canSubmit(input = {}) {
    const unresolved = Math.max(0, Number(input.unresolvedRequired || 0));
    if (!input.applicationUiFound) return { ok: false, reason: "application-ui-not-found" };
    if (input.coverLetterRequired && !input.coverLetterFilled) return { ok: false, reason: "cover-letter-not-persisted" };
    if (unresolved) return { ok: false, reason: "required-fields" };
    if (input.cvFieldPresent && !input.cvUploaded) return { ok: false, reason: "cv-not-uploaded" };
    if (!input.finalFound) return { ok: false, reason: "final-action-not-found" };
    if (input.finalAmbiguous) return { ok: false, reason: "final-action-ambiguous" };
    return { ok: true, reason: "ready" };
  }

  function finalSubmissionConfirmed(input = {}) {
    if (input.receiptAdvanced) return true;
    if (!input.coverLetterRequired) return Boolean(input.receiptConfirmed);
    if (input.isHh && input.startActionSubmitted && input.letterStepCompleted) return true;
    return Boolean(input.receiptConfirmed && input.letterStepCompleted);
  }

  return { clean, safeUrl, isHhUrl, sameJobUrl, hostFamily, tenantKey, isApplicationLike, titleMatches, canResume, canAcceptReceipt, scoreStartAction, chooseStartAction, chooseHhCoverLetterAction, isApplicationContainerText, startReceiptDisposition, scoreCoverLetterField, chooseCoverLetterField, chooseHhResumeChoice, unresolvedRequired, canSubmit, finalSubmissionConfirmed };
});
