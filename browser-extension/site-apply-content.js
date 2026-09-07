function vjaSiteText(el) {
  return String(el?.innerText || el?.textContent || el?.value || el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || '')
    .replace(/\s+/g, ' ').trim();
}

function vjaSiteVisible(el) {
  if (!el || el.disabled || el.getAttribute?.('aria-disabled') === 'true') return false;
  const style = getComputedStyle(el);
  return el.offsetParent !== null && style.display !== 'none' && style.visibility !== 'hidden';
}

function vjaSiteLabel(el) {
  const parts = [vjaSiteText(el), el?.name || '', el?.id || '', el?.getAttribute?.('placeholder') || '', el?.getAttribute?.('aria-label') || ''];
  if (el?.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) parts.push(vjaSiteText(label));
    } catch { }
  }
  const parent = el?.closest?.('label');
  if (parent) parts.push(vjaSiteText(parent));
  const group = el?.closest?.('fieldset, [role="group"], [class*="field"], [class*="question"], [data-qa*="resume" i]');
  if (group) parts.push(vjaSiteText(group).slice(0, 300));
  return [...new Set(parts.map(x => String(x || '').trim()).filter(Boolean))].join(' ').slice(0, 800);
}

function vjaSiteIsHh() {
  if (window.vjaSiteApply?.isHhUrl) return window.vjaSiteApply.isHhUrl(location.href);
  return /(^|\.)hh\.ru$/i.test(location.hostname);
}

function vjaSiteApplicationContainer() {
  const dialogs = [...document.querySelectorAll('[role="dialog"], dialog')].filter(vjaSiteVisible);
  const applicationDialogs = dialogs.filter(dialog => /apply|application|resume|cv|cover letter|отклик|резюме|сопровод|отправить/i.test(vjaSiteText(dialog)));
  if (applicationDialogs.length === 1) return applicationDialogs[0];
  if (dialogs.length === 1) return dialogs[0];

  const forms = [...document.querySelectorAll('form')].filter(vjaSiteVisible).filter(form => {
    const text = vjaSiteText(form).toLowerCase();
    return /apply|application|resume|cv|cover letter|отклик|резюме|сопровод/.test(text);
  });
  if (forms.length === 1) return forms[0];
  return null;
}

function vjaSiteStartCandidates() {
  return [...document.querySelectorAll('button, a, [role="button"]')]
    .filter(vjaSiteVisible)
    .map(el => ({
      el,
      label: vjaSiteText(el).slice(0, 160),
      metadata: {
        href: el.getAttribute?.('href') || '',
        inForm: Boolean(el.closest?.('form')),
        inDialog: Boolean(el.closest?.('[role="dialog"], dialog')),
        primary: /primary|accent|success|purple|violet/i.test(String(el.className || ''))
      }
    }));
}

function vjaSiteCoverLetterField(container = document) {
  const fields = [...container.querySelectorAll('textarea, input[type="text"], [contenteditable="true"][role="textbox"], [contenteditable="true"]')]
    .filter(vjaSiteVisible)
    .map(el => ({
      el,
      label: vjaSiteLabel(el),
      metadata: { textarea: el instanceof HTMLTextAreaElement || el.isContentEditable, required: Boolean(el.required || el.getAttribute?.('aria-required') === 'true') }
    }));
  const choice = window.vjaSiteApply?.chooseCoverLetterField?.(fields) || { found: false };
  if (choice.found) return choice.candidate.el;
  const textareas = fields.filter(x => x.metadata.textarea);
  return textareas.length === 1 ? textareas[0].el : null;
}

function vjaSiteSetText(el, value) {
  if (!el || !value) return false;
  if (el.isContentEditable) {
    el.focus();
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return vjaSiteText(el).length > 0;
  }
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return String(el.value || '').trim().length > 0;
}

function vjaSiteFieldValue(el) {
  return el?.isContentEditable ? vjaSiteText(el) : String(el?.value || '').trim();
}

async function vjaSiteSetTextVerified(el, value) {
  const expected = String(value || '').trim();
  if (!el || !expected) return false;
  const normalize = window.vjaSiteApply?.clean || (input => String(input || '').replace(/\s+/g, ' ').trim());
  for (let attempt = 0; attempt < 3; attempt++) {
    vjaSiteSetText(el, expected);
    await vjaSiteWait(120 + attempt * 80);
    const actual = vjaSiteFieldValue(el);
    if (normalize(actual) === normalize(expected)) return true;
  }
  return false;
}

function vjaSiteRequiredFields(container = document) {
  const nodes = [...container.querySelectorAll('input[required], textarea[required], select[required], [aria-required="true"]')]
    .filter(el => !el.disabled)
    .map(el => ({
      label: vjaSiteLabel(el),
      required: true,
      disabled: Boolean(el.disabled),
      hidden: !vjaSiteVisible(el) || (el instanceof HTMLInputElement && el.type === 'hidden'),
      type: el instanceof HTMLInputElement ? el.type : (el instanceof HTMLSelectElement ? 'select' : 'text'),
      group: el instanceof HTMLInputElement && el.type === 'radio' ? (el.name || vjaSiteLabel(el)) : '',
      value: 'value' in el ? String(el.value || '') : '',
      checked: Boolean(el.checked),
      fileCount: el instanceof HTMLInputElement && el.type === 'file' ? Number(el.files?.length || 0) : 0
    }));
  return window.vjaSiteApply?.unresolvedRequired?.(nodes) || [];
}

function vjaSiteFinalChoice(container = document) {
  const applicationRoute = /application|candidate|apply|response|respond|negotiation|vacancy/i.test(location.pathname + location.search);
  const candidates = [...container.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')]
    .filter(vjaSiteVisible)
    .map(el => ({
      el,
      label: vjaSiteText(el).slice(0, 160),
      metadata: {
        submitType: Boolean(el.matches?.('button[type="submit"], input[type="submit"]')),
        inForm: Boolean(el.closest?.('form') || el.closest?.('[role="dialog"], dialog')),
        applicationRoute
      }
    }));
  const choice = window.vjaFinalSubmitControl?.choose?.(candidates) || { found: false, ambiguous: false, count: 0 };
  if (choice.found || choice.ambiguous) return choice;
  const submitButtons = candidates.filter(item => item.metadata.submitType);
  if (submitButtons.length === 1 && container !== document) {
    return { found: true, ambiguous: false, count: 1, candidate: { ...submitButtons[0], score: 8, fallback: 'single-submit-control' } };
  }
  return choice;
}

function vjaSiteReceipt() {
  const detector = window.vjaSubmissionReceipt;
  if (!detector?.detect) return { confirmed: false, score: 0, signal: 'detector-unavailable' };
  const result = detector.detect({
    url: location.href,
    title: document.title,
    text: String(document.body?.innerText || document.body?.textContent || '').slice(0, 50000)
  });
  return { confirmed: Boolean(result.confirmed), score: Number(result.score || 0), signal: String(result.signal || 'none') };
}

function vjaSiteWait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function vjaSiteWaitForApplicationUi(timeoutMs = 9000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const container = vjaSiteApplicationContainer();
    if (container || document.querySelector('input[type="file"], textarea, [contenteditable="true"], [data-qa*="resume" i], input[type="radio"]')) return true;
    await vjaSiteWait(250);
  }
  return false;
}

function vjaHhResumeCandidates(container = document) {
  const all = [...container.querySelectorAll('input[type="radio"], [role="radio"]')];
  return all.map(el => {
    const wrapper = el.closest?.('label, [data-qa*="resume" i], [class*="resume" i], [role="group"], fieldset') || el.parentElement;
    const label = `${vjaSiteLabel(el)} ${vjaSiteText(wrapper)}`.replace(/\s+/g, ' ').trim().slice(0, 1000);
    const resumeRelated = /резюме|resume|cv|профил/i.test(label)
      || /resume/i.test(String(el.getAttribute?.('data-qa') || ''))
      || /resume/i.test(String(el.getAttribute?.('name') || ''));
    if (!resumeRelated) return null;
    const selected = Boolean(el.checked)
      || el.getAttribute?.('aria-checked') === 'true'
      || wrapper?.getAttribute?.('aria-checked') === 'true'
      || /selected|checked|active/i.test(String(wrapper?.className || ''));
    return {
      el,
      wrapper,
      label,
      metadata: {
        selected,
        disabled: Boolean(el.disabled || el.getAttribute?.('aria-disabled') === 'true'),
        visible: vjaSiteVisible(el) || vjaSiteVisible(wrapper)
      }
    };
  }).filter(item => item && item.metadata.visible);
}

async function vjaHhSelectResume(container = document, plan = {}) {
  if (!vjaSiteIsHh()) return { ok: true, found: false, reason: 'not-hh', label: '' };
  const candidates = vjaHhResumeCandidates(container);
  if (!candidates.length) {
    return { ok: true, found: false, reason: 'hh-uses-current-account-resume', label: 'HH account resume' };
  }
  const choice = window.vjaSiteApply?.chooseHhResumeChoice?.(candidates, plan.resumeHint || '') || { found: false, ambiguous: true };
  if (!choice.found) {
    return {
      ok: false,
      found: true,
      reason: 'hh-resume-choice-required',
      choices: candidates.map(item => item.label).filter(Boolean).slice(0, 5)
    };
  }

  const candidate = choice.candidate;
  if (!candidate.metadata?.selected) {
    candidate.wrapper?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    if (candidate.el instanceof HTMLInputElement) {
      candidate.el.click();
      candidate.el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      (candidate.wrapper || candidate.el).click();
    }
    await vjaSiteWait(180);
  }

  const nowSelected = candidate.el instanceof HTMLInputElement
    ? Boolean(candidate.el.checked)
    : candidate.el.getAttribute?.('aria-checked') === 'true' || candidate.wrapper?.getAttribute?.('aria-checked') === 'true';
  if (!candidate.metadata?.selected && !nowSelected) {
    return { ok: false, found: true, reason: 'hh-resume-selection-not-persisted', choices: candidates.map(item => item.label).filter(Boolean).slice(0, 5) };
  }

  return { ok: true, found: true, reason: choice.reason || 'selected', label: candidate.label || 'HH account resume' };
}

async function vjaSiteLoadCv(plan) {
  if (plan?.fileData?.base64) return plan.fileData;
  const key = plan?.cvKey;
  if (!key) return null;
  const stored = await chrome.storage.local.get(key);
  return stored[key] || null;
}

async function vjaSiteStoreResult(plan, result) {
  const payload = {
    id: plan?.id || '',
    trackedId: plan?.trackedId || '',
    sourceUrl: plan?.sourceUrl || '',
    result,
    createdAt: Date.now()
  };
  await chrome.storage.local.set({ vjaSiteApplyResult: payload });
  if (result?.submitted || result?.status === 'needs-review' || result?.status === 'verification-needed') {
    const stored = await chrome.storage.local.get('vjaPendingSiteApply');
    if (stored.vjaPendingSiteApply?.id === plan?.id) await chrome.storage.local.remove('vjaPendingSiteApply');
  }
}

async function vjaRunSiteApply(plan = {}, options = {}) {
  if (plan.finalClicked) {
    await vjaSiteWait(1200);
    const receipt = vjaSiteReceipt();
    const result = window.vjaSiteApply?.canAcceptReceipt?.({ finalClicked: true, receiptConfirmed: receipt.confirmed })
      ? { submitted: true, status: 'confirmed', receipt, resumed: true }
      : { submitted: false, status: 'verification-needed', receipt, reason: 'The final employer action was already clicked, but submission could not be verified automatically.' };
    await vjaSiteStoreResult(plan, result);
    return result;
  }

  let container = vjaSiteApplicationContainer();
  let applicationUiFound = Boolean(container || document.querySelector('input[type="file"], textarea, [contenteditable="true"], input[required], select[required], [aria-required="true"]'));
  if (!container && !applicationUiFound) {
    const startChoice = window.vjaSiteApply?.chooseStartAction?.(vjaSiteStartCandidates()) || { found: false };
    if (!startChoice.found) {
      const result = { submitted: false, status: 'needs-review', reason: startChoice.ambiguous ? 'Several Apply/Откликнуться buttons were found.' : 'No safe Apply/Откликнуться button was found.' };
      await vjaSiteStoreResult(plan, result);
      return result;
    }
    const receiptBeforeStart = vjaSiteReceipt();
    startChoice.candidate.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    startChoice.candidate.el.click();
    applicationUiFound = await vjaSiteWaitForApplicationUi();

    const postStartReceipt = vjaSiteReceipt();
    if (!receiptBeforeStart.confirmed && postStartReceipt.confirmed) {
      const result = { submitted: true, status: 'confirmed', receipt: postStartReceipt, startActionSubmitted: true };
      await vjaSiteStoreResult(plan, result);
      return result;
    }
    container = vjaSiteApplicationContainer();
  }

  const scope = container || document;
  const coverLetter = String(plan.coverLetter || '').trim();
  const coverLetterRequired = vjaSiteIsHh() && Boolean(coverLetter);
  const coverField = vjaSiteCoverLetterField(scope);
  let coverLetterFilled = false;
  if (coverField && coverLetter) {
    coverLetterFilled = await vjaSiteSetTextVerified(coverField, coverLetter);
    if (!coverLetterFilled) {
      const result = { submitted: false, status: 'needs-review', reason: 'cover-letter-not-persisted', coverLetterFilled: false };
      await vjaSiteStoreResult(plan, result);
      return result;
    }
  }
  if (coverLetterRequired && !coverLetterFilled) {
    const result = { submitted: false, status: 'needs-review', reason: 'cover-letter-not-persisted', coverLetterFilled: false };
    await vjaSiteStoreResult(plan, result);
    return result;
  }

  const hhResume = await vjaHhSelectResume(scope, plan);
  if (!hhResume.ok) {
    const result = {
      submitted: false,
      status: 'needs-review',
      reason: hhResume.reason,
      unresolved: hhResume.choices || [],
      coverLetterFilled,
      resumeLabel: ''
    };
    await vjaSiteStoreResult(plan, result);
    return result;
  }

  const fileInputPresent = !vjaSiteIsHh() && Boolean(scope.querySelector?.('input[type="file"]'));
  const fileData = fileInputPresent ? await vjaSiteLoadCv(plan) : null;
  let cvUploaded = false;
  let cvResult = null;
  if (fileInputPresent) {
    if (!fileData?.base64) {
      const result = { submitted: false, status: 'needs-review', reason: 'This application has a CV upload field, but the recommended CV is not available in the local CV Vault.' };
      await vjaSiteStoreResult(plan, result);
      return result;
    }
    cvResult = typeof vjaUploadCv === 'function' ? vjaUploadCv(fileData) : { success: false, error: 'CV uploader is unavailable.' };
    cvUploaded = Boolean(cvResult?.success);
  }

  await vjaSiteWait(180);
  const unresolved = vjaSiteRequiredFields(scope);
  const finalChoice = vjaSiteFinalChoice(scope);
  const permission = window.vjaSiteApply?.canSubmit?.({
    applicationUiFound,
    coverLetterRequired,
    coverLetterFilled,
    unresolvedRequired: unresolved.length,
    cvFieldPresent: fileInputPresent,
    cvUploaded,
    finalFound: Boolean(finalChoice.found),
    finalAmbiguous: Boolean(finalChoice.ambiguous)
  }) || { ok: false, reason: 'site-apply-model-unavailable' };

  if (!permission.ok) {
    const result = {
      submitted: false,
      status: 'needs-review',
      reason: permission.reason,
      unresolved: unresolved.map(x => x.label).filter(Boolean).slice(0, 8),
      coverLetterFilled,
      cvUploaded,
      cvResult,
      resumeLabel: hhResume.label || ''
    };
    await vjaSiteStoreResult(plan, result);
    return result;
  }

  const pending = { ...plan, finalClicked: true, finalClickedAt: Date.now(), resumeLabel: hhResume.label || '' };
  await chrome.storage.local.set({ vjaPendingSiteApply: pending });
  finalChoice.candidate.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  finalChoice.candidate.el.click();
  await vjaSiteWait(2200);

  const receipt = vjaSiteReceipt();
  const common = { coverLetterFilled, cvUploaded, cvResult, resumeLabel: hhResume.label || '' };
  const result = receipt.confirmed
    ? { submitted: true, status: 'confirmed', receipt, ...common }
    : { submitted: false, status: 'clicked-unverified', receipt, ...common, reason: 'Final employer action was clicked; reopen the extension if the site did not show a confirmation.' };

  if (receipt.confirmed) await vjaSiteStoreResult(plan, result);
  else await chrome.storage.local.set({ vjaSiteApplyResult: { id: plan?.id || '', trackedId: plan?.trackedId || '', sourceUrl: plan?.sourceUrl || '', result, createdAt: Date.now() } });
  return result;
}

async function vjaResumePendingSiteApply() {
  const stored = await chrome.storage.local.get('vjaPendingSiteApply');
  const pending = stored.vjaPendingSiteApply;
  if (!pending) return;
  const expiresAt = Number(pending.expiresAt || 0);
  if (expiresAt && Date.now() > expiresAt) {
    await chrome.storage.local.remove('vjaPendingSiteApply');
    return;
  }
  const continuation = window.vjaSiteApply?.canResume?.({
    sourceUrl: pending.sourceUrl,
    currentUrl: location.href,
    jobTitle: pending.jobTitle,
    pageText: `${document.title}\n${String(document.body?.innerText || document.body?.textContent || '').slice(0, 50000)}`
  });
  if (!continuation?.ok) return;
  await vjaSiteWait(700);
  await vjaRunSiteApply(pending, { resumed: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'siteApplyNow') return false;
  vjaRunSiteApply(message.plan || {})
    .then(sendResponse)
    .catch(error => sendResponse({ submitted: false, status: 'error', error: error?.message || String(error) }));
  return true;
});

vjaResumePendingSiteApply().catch(() => {});
