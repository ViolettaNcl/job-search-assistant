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
  const group = el?.closest?.('fieldset, [role="group"], [class*="field"], [class*="question"]');
  if (group) parts.push(vjaSiteText(group).slice(0, 300));
  return [...new Set(parts.map(x => String(x || '').trim()).filter(Boolean))].join(' ').slice(0, 800);
}

function vjaSiteApplicationContainer() {
  const dialogs = [...document.querySelectorAll('[role="dialog"], dialog')].filter(vjaSiteVisible);
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
  const fields = [...container.querySelectorAll('textarea, input[type="text"]')]
    .filter(vjaSiteVisible)
    .map(el => ({
      el,
      label: vjaSiteLabel(el),
      metadata: { textarea: el instanceof HTMLTextAreaElement, required: Boolean(el.required || el.getAttribute?.('aria-required') === 'true') }
    }));
  const choice = window.vjaSiteApply?.chooseCoverLetterField?.(fields) || { found: false };
  if (choice.found) return choice.candidate.el;
  const textareas = fields.filter(x => x.metadata.textarea);
  return textareas.length === 1 ? textareas[0].el : null;
}

function vjaSiteSetText(el, value) {
  if (!el || !value) return false;
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return String(el.value || '').trim().length > 0;
}

function vjaSiteRequiredFields(container = document) {
  const nodes = [...container.querySelectorAll('input[required], textarea[required], select[required], [aria-required="true"]')]
    .filter(el => !el.disabled)
    .map(el => ({
      label: vjaSiteLabel(el),
      required: true,
      disabled: Boolean(el.disabled),
      hidden: el instanceof HTMLInputElement && el.type === 'hidden',
      type: el instanceof HTMLInputElement ? el.type : (el instanceof HTMLSelectElement ? 'select' : 'text'),
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
  return window.vjaFinalSubmitControl?.choose?.(candidates) || { found: false, ambiguous: false, count: 0 };
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
    if (container || document.querySelector('input[type="file"], textarea')) return true;
    await vjaSiteWait(250);
  }
  return false;
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
    await chrome.storage.local.remove('vjaPendingSiteApply');
  }
}

async function vjaRunSiteApply(plan = {}, options = {}) {
  const initialReceipt = vjaSiteReceipt();
  if (initialReceipt.confirmed) {
    const result = { submitted: true, status: 'confirmed', receipt: initialReceipt, resumed: Boolean(options.resumed) };
    await vjaSiteStoreResult(plan, result);
    return result;
  }

  if (plan.finalClicked) {
    await vjaSiteWait(1200);
    const receipt = vjaSiteReceipt();
    const result = receipt.confirmed
      ? { submitted: true, status: 'confirmed', receipt, resumed: true }
      : { submitted: false, status: 'verification-needed', receipt, reason: 'The final employer action was already clicked, but submission could not be verified automatically.' };
    await vjaSiteStoreResult(plan, result);
    return result;
  }

  let container = vjaSiteApplicationContainer();
  if (!container) {
    const startChoice = window.vjaSiteApply?.chooseStartAction?.(vjaSiteStartCandidates()) || { found: false };
    if (!startChoice.found) {
      const result = { submitted: false, status: 'needs-review', reason: startChoice.ambiguous ? 'Several Apply/Откликнуться buttons were found.' : 'No safe Apply/Откликнуться button was found.' };
      await vjaSiteStoreResult(plan, result);
      return result;
    }
    startChoice.candidate.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    startChoice.candidate.el.click();
    await vjaSiteWaitForApplicationUi();
    container = vjaSiteApplicationContainer();
  }

  const scope = container || document;
  const coverField = vjaSiteCoverLetterField(scope);
  let coverLetterFilled = false;
  if (coverField && String(plan.coverLetter || '').trim()) {
    coverLetterFilled = vjaSiteSetText(coverField, plan.coverLetter);
  }

  const fileInputPresent = Boolean(scope.querySelector?.('input[type="file"]'));
  const fileData = await vjaSiteLoadCv(plan);
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

  await vjaSiteWait(150);
  const unresolved = vjaSiteRequiredFields(scope);
  const finalChoice = vjaSiteFinalChoice(scope);
  const permission = window.vjaSiteApply?.canSubmit?.({
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
      cvResult
    };
    await vjaSiteStoreResult(plan, result);
    return result;
  }

  const pending = { ...plan, finalClicked: true, finalClickedAt: Date.now() };
  await chrome.storage.local.set({ vjaPendingSiteApply: pending });
  finalChoice.candidate.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  finalChoice.candidate.el.click();
  await vjaSiteWait(2200);

  const receipt = vjaSiteReceipt();
  const result = receipt.confirmed
    ? { submitted: true, status: 'confirmed', receipt, coverLetterFilled, cvUploaded, cvResult }
    : { submitted: false, status: 'clicked-unverified', receipt, coverLetterFilled, cvUploaded, cvResult, reason: 'Final employer action was clicked; reopen the extension if the site did not show a confirmation.' };

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
  let sourceHost = '';
  try { sourceHost = new URL(pending.sourceUrl || '').hostname; } catch { }
  if (sourceHost && sourceHost !== location.hostname) return;
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
