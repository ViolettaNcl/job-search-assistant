/* Violetta Apply Assistant · Avito vacancies BETA.
   Reads an exact vacancy, keeps Fit/Calls controls visible, prepares a
   vacancy-specific message from confirmed candidate facts and, only after the
   user explicitly presses “Письмо”, opens the matching Avito chat, fills the
   composer and sends that one message. */
(function (root) {
  'use strict';
  if (root.__vjaAvitoVacancies || window.top !== window) return;

  const C = root.vjaCopilotCore;
  const A = root.vjaSiteAdapters;
  const V = root.vjaAvitoVacanciesCore;
  if (!C || !A || !V || !V.isSupportedHost(location.href)) return;

  root.__vjaAvitoVacancies = true;

  const request = (op, args = {}) => chrome.runtime.sendMessage({ type: 'vjaCopilot', op, ...args });
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const records = new Map();
  const running = new Set();
  const restoring = new Set();
  const ids = {
    style: 'vja-avito-style',
    toolbar: 'vja-avito-toolbar',
    modal: 'vja-avito-letter-modal',
    detail: 'vja-avito-detail-panel',
    toast: 'vja-avito-toast'
  };
  const pendingKey = 'vjaAvitoPendingMessageV2';
  let scanTimer = null;
  let batchToken = 0;
  let filter = 'all';
  let pendingResumeInFlight = false;

  function installStyle() {
    if (document.getElementById(ids.style)) return;
    const style = document.createElement('style');
    style.id = ids.style;
    style.textContent = `
      .vja-avito-card-enhanced{position:relative!important;isolation:isolate!important;padding-bottom:68px!important}
      .vja-avito-card-enhanced>[data-vja-root="avito-controls"],
      .vja-avito-card-enhanced:hover>[data-vja-root="avito-controls"],
      .vja-avito-card-enhanced:focus-within>[data-vja-root="avito-controls"]{
        position:absolute!important;left:16px!important;bottom:12px!important;right:auto!important;top:auto!important;
        display:flex!important;visibility:visible!important;opacity:1!important;transform:none!important;max-height:none!important;
        overflow:visible!important;pointer-events:auto!important;z-index:2147482500!important
      }
      [data-vja-root="avito-controls"]{align-items:center;gap:7px;flex-wrap:wrap;margin:0!important;padding:0!important;border:0!important;font:600 12px/1.2 system-ui,sans-serif}
      [data-vja-root="avito-controls"] button,#${ids.toolbar} button,#${ids.toolbar} select,#${ids.detail} button{appearance:none;border:1px solid #d5d8e2;border-radius:10px;background:#fff;color:#202436;padding:8px 11px;font:650 12px/1 system-ui,sans-serif;cursor:pointer}
      [data-vja-root="avito-controls"] button:hover,#${ids.toolbar} button:hover,#${ids.detail} button:hover{background:#f5f6fa}
      [data-vja-root="avito-controls"] button:focus-visible,#${ids.toolbar} button:focus-visible,#${ids.detail} button:focus-visible,#${ids.modal} button:focus-visible,#${ids.modal} textarea:focus-visible{outline:3px solid rgba(103,80,194,.28);outline-offset:2px}
      [data-vja-root="avito-controls"] button[data-primary="1"],#${ids.toolbar} button[data-primary="1"],#${ids.detail} button[data-primary="1"]{background:#6554bd;border-color:#6554bd;color:#fff}
      [data-vja-root="avito-controls"] button[disabled],#${ids.toolbar} button[disabled],#${ids.detail} button[disabled]{opacity:.58;cursor:default}
      .vja-avito-chip{display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center;border:1px solid #d7dae3;border-radius:999px;padding:7px 9px;background:#f7f7fa;color:#555d70;font:700 11px/1 system-ui,sans-serif;white-space:nowrap}
      .vja-avito-chip[data-state="no-calls"],.vja-avito-chip[data-state="strong"]{background:#e7f7ed;border-color:#a8ddbb;color:#116139}
      .vja-avito-chip[data-state="calls"],.vja-avito-chip[data-state="skip"]{background:#fff0ef;border-color:#edb4af;color:#982c27}
      .vja-avito-chip[data-state="match"]{background:#edf4ff;border-color:#bbcff2;color:#2456a4}
      .vja-avito-chip[data-state="review"],.vja-avito-chip[data-state="unknown"]{background:#fff8e5;border-color:#ead08d;color:#755612}
      #${ids.toolbar}{position:fixed;left:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:7px;flex-wrap:wrap;max-width:min(720px,calc(100vw - 36px));padding:10px;border:1px solid #d8dce8;border-radius:14px;background:rgba(255,255,255,.97);box-shadow:0 12px 34px rgba(22,31,55,.16);font:600 12px/1.2 system-ui,sans-serif;color:#273047;backdrop-filter:blur(10px)}
      #${ids.toolbar} .vja-avito-progress{font-weight:500;color:#6b7280;white-space:nowrap}
      #${ids.detail}{position:fixed;left:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:7px;flex-wrap:wrap;max-width:min(680px,calc(100vw - 36px));padding:10px;border:1px solid #d8dce8;border-radius:14px;background:rgba(255,255,255,.97);box-shadow:0 12px 34px rgba(22,31,55,.16);font:600 12px/1.2 system-ui,sans-serif;color:#273047;backdrop-filter:blur(10px)}
      #${ids.detail} strong{font-size:12px}#${ids.detail} small{font-weight:500;color:#697187}
      #${ids.modal}{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:18px;background:rgba(15,18,28,.56);font-family:system-ui,sans-serif}
      #${ids.modal} .vja-avito-dialog{width:min(680px,100%);max-height:min(760px,calc(100vh - 36px));overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.28);padding:24px;color:#161922}
      #${ids.modal} h2{margin:0 0 6px;font-size:25px;line-height:1.2}#${ids.modal} .vja-avito-subtitle{margin:0 0 16px;color:#656c7b;font-size:13px;line-height:1.45}
      #${ids.modal} textarea{box-sizing:border-box;width:100%;min-height:240px;resize:vertical;border:1px solid #cfd4df;border-radius:14px;padding:15px;font:500 15px/1.45 system-ui,sans-serif;color:#161922;background:#fff}
      #${ids.modal} .vja-avito-modal-status{min-height:20px;margin:10px 0 0;color:#5f6675;font-size:13px}#${ids.modal} .vja-avito-modal-status[data-kind="ok"]{color:#116139}#${ids.modal} .vja-avito-modal-status[data-kind="bad"]{color:#982c27}
      #${ids.modal} .vja-avito-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:18px}#${ids.modal} button{border:1px solid #d5d8e2;border-radius:11px;background:#f5f6fa;color:#202436;padding:11px 15px;font:700 14px/1 system-ui,sans-serif;cursor:pointer}#${ids.modal} button[data-primary="1"]{background:#6554bd;border-color:#6554bd;color:#fff}
      #${ids.toast}{position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:min(440px,calc(100vw - 36px));padding:13px 16px;border:1px solid #cfd5e2;border-radius:13px;background:#fff;color:#263047;box-shadow:0 14px 40px rgba(20,30,50,.2);font:650 13px/1.4 system-ui,sans-serif}
      #${ids.toast}[data-kind="ok"]{border-color:#a8ddbb;color:#116139}#${ids.toast}[data-kind="bad"]{border-color:#edb4af;color:#982c27}
      [data-vja-avito-hidden="1"]{display:none!important}.vja-avito-card-strong{box-shadow:inset 3px 0 #24a268}.vja-avito-card-calls{box-shadow:inset 3px 0 #d0473f}
      @media(max-width:720px){#${ids.toolbar},#${ids.detail}{left:8px;right:8px;bottom:8px;max-width:none}.vja-avito-card-enhanced{padding-bottom:112px!important}#${ids.modal}{padding:8px}#${ids.modal} .vja-avito-dialog{border-radius:16px;padding:17px}#${ids.modal} textarea{min-height:210px}}
      @media(prefers-reduced-motion:reduce){#${ids.modal},#${ids.toolbar},#${ids.detail}{scroll-behavior:auto}}
    `;
    document.documentElement.append(style);
  }

  function clean(value) {
    return C.clean(String(value ?? ''));
  }

  function text(el, max = 3000) {
    return C.clip(el?.innerText || el?.textContent || '', max);
  }

  function visible(el) {
    if (!el || !el.isConnected || el.closest?.('[data-vja-root]')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.getClientRects().length > 0;
  }

  function buttonLabel(el) {
    return clean(el?.innerText || el?.textContent || el?.value || el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || '');
  }

  function titleLink(scope) {
    return [...scope.querySelectorAll('a[href*="/vakansii/"]')].find(a => V.isVacancyUrl(a.href) && (/item-title/i.test(a.getAttribute('data-marker') || '') || a.querySelector('h2,h3') || text(a, 400).length > 3))
      || [...scope.querySelectorAll('a[href*="/vakansii/"]')].find(a => V.isVacancyUrl(a.href))
      || null;
  }

  function cardFromLink(link) {
    const direct = link.closest('[data-marker="item"],[data-item-id],article,li');
    if (direct) return direct;
    let node = link.parentElement;
    let best = null;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      const value = text(node, 16000);
      if (value.length >= 40 && value.length <= 12000 && node.querySelectorAll('a[href*="/vakansii/"]').length === 1) best = node;
      if (node.matches('main,section')) break;
    }
    return best;
  }

  function cards() {
    const map = new Map();
    for (const link of document.querySelectorAll('a[href*="/vakansii/"]')) {
      if (!V.isVacancyUrl(link.href)) continue;
      const card = cardFromLink(link);
      if (!card || card.closest('[data-vja-root]')) continue;
      const id = V.vacancyIdFromUrl(link.href);
      if (id && !map.has(id)) map.set(id, card);
    }
    return [...map.values()];
  }

  function pick(scope, selectors) {
    for (const selector of selectors) {
      const el = [...scope.querySelectorAll(selector)].find(x => !x.closest('[data-vja-root]') && text(x, 1200));
      if (el) return text(el, 5000);
    }
    return '';
  }

  function extractVacancy(card) {
    const link = titleLink(card);
    if (!link) return null;
    const url = C.canonicalUrl(link.href);
    const vacancyId = V.vacancyIdFromUrl(url);
    if (!vacancyId) return null;
    const title = C.clip(pick(card, ['[data-marker="item-title"]', 'h3', 'h2']) || text(link, 500), 300);
    if (!title || C.suspiciousVacancyTitle?.(title)) return null;
    const company = C.clip(pick(card, ['[data-marker*="seller"] [data-marker*="name"]', '[data-marker*="company"]', '[class*="seller"]', '[class*="company"]']), 300);
    const description = C.clip(pick(card, ['[data-marker="item-description"]', '[data-marker*="description"]', 'p']) || text(card, 9000), 12000);
    const locationText = C.clip(pick(card, ['[data-marker="item-address"]', '[data-marker*="address"]', '[class*="geo"]']), 300);
    return C.vacancy({
      provider: 'avito',
      url,
      vacancyId,
      title,
      company,
      description,
      location: locationText,
      remote: /удал[её]н|дистанцион|remote|из дома/i.test(description),
      descriptionCoverage: 'snippet'
    });
  }

  function currentDetailVacancy() {
    const adapter = A.make(document, location.href);
    const vacancy = adapter.extractVacancy();
    return vacancy?.provider === 'avito' && V.isVacancyUrl(vacancy.url) && vacancy.title ? vacancy : null;
  }

  function nativeWriteButton(scope = document) {
    const candidates = [...scope.querySelectorAll('button,a,[role="button"]')]
      .filter(el => !el.closest('[data-vja-root]'));
    return candidates.find(el => visible(el) && /^(?:написать|откликнуться|связаться|ответить)$/i.test(buttonLabel(el)))
      || candidates.find(el => /^(?:написать|откликнуться|связаться|ответить)$/i.test(buttonLabel(el)))
      || null;
  }

  function emitHover(card) {
    if (!card) return;
    for (const type of ['pointerover', 'mouseover', 'pointerenter', 'mouseenter']) {
      try {
        card.dispatchEvent(new MouseEvent(type, { bubbles: type.endsWith('over'), cancelable: true, view: window }));
      } catch {}
    }
  }

  function markCard(card, vacancy) {
    if (!card) return;
    card.classList.add('vja-avito-card-enhanced');
    card.dataset.vjaAvitoVacancyId = String(vacancy?.vacancyId || '');
    if (card.dataset.vjaAvitoHoverBound === '1') return;
    card.dataset.vjaAvitoHoverBound = '1';
    const keep = () => {
      const latest = findCard(vacancy) || card;
      latest.classList.add('vja-avito-card-enhanced');
      if (!latest.querySelector('[data-vja-root="avito-controls"]')) controls(latest, extractVacancy(latest) || vacancy);
      const bar = latest.querySelector('[data-vja-root="avito-controls"]');
      if (bar) {
        bar.style.setProperty('display', 'flex', 'important');
        bar.style.setProperty('visibility', 'visible', 'important');
        bar.style.setProperty('opacity', '1', 'important');
      }
    };
    card.addEventListener('pointerenter', () => requestAnimationFrame(keep), { passive: true });
    card.addEventListener('mouseenter', () => requestAnimationFrame(keep), { passive: true });
    card.addEventListener('focusin', () => requestAnimationFrame(keep));
  }

  function findCard(vacancy) {
    const id = String(vacancy?.vacancyId || '');
    if (!id) return null;
    return cards().find(card => String(extractVacancy(card)?.vacancyId || '') === id) || null;
  }

  function controls(card, vacancy) {
    markCard(card, vacancy);
    let bar = card.querySelector('[data-vja-root="avito-controls"]');
    if (bar) {
      bar.style.setProperty('display', 'flex', 'important');
      bar.style.setProperty('visibility', 'visible', 'important');
      bar.style.setProperty('opacity', '1', 'important');
      return bar;
    }

    bar = document.createElement('div');
    bar.dataset.vjaRoot = 'avito-controls';
    bar.dataset.vacancyId = vacancy.vacancyId;

    const analyze = document.createElement('button');
    analyze.type = 'button';
    analyze.dataset.role = 'analyze';
    analyze.textContent = '✦ Analysis';
    analyze.title = 'Прочитать полную вакансию в фоновой вкладке и рассчитать Fit / Calls.';

    const letter = document.createElement('button');
    letter.type = 'button';
    letter.dataset.role = 'letter';
    letter.dataset.primary = '1';
    letter.textContent = '✉ Письмо';
    letter.title = 'Проанализировать вакансию, открыть точный чат Avito, вставить индивидуальное письмо и отправить его.';

    const fit = document.createElement('span');
    fit.className = 'vja-avito-chip';
    fit.dataset.role = 'fit';
    fit.dataset.state = 'unknown';
    fit.textContent = 'Fit —';

    const calls = document.createElement('span');
    calls.className = 'vja-avito-chip';
    calls.dataset.role = 'calls';
    calls.dataset.state = 'unknown';
    calls.textContent = 'Звонки —';

    analyze.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      void analyzeVacancy(card, vacancy, true);
    });
    letter.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      void prepareAndSend(card, vacancy);
    });

    bar.append(analyze, letter, fit, calls);
    card.append(bar);
    return bar;
  }

  function setWorking(bar, kind, on, label) {
    const button = bar?.querySelector(`[data-role="${kind}"]`);
    if (!button) return;
    button.disabled = on;
    if (label) button.textContent = label;
  }

  function renderRecord(card, result) {
    if (!card || !result) return;
    const vacancy = result.vacancy || extractVacancy(card);
    const bar = controls(card, vacancy);
    const fit = bar.querySelector('[data-role="fit"]');
    const calls = bar.querySelector('[data-role="calls"]');
    const analyze = bar.querySelector('[data-role="analyze"]');
    const score = Number(result.fit?.score);

    fit.textContent = Number.isFinite(score) ? `${Math.round(score)}% Match` : 'Fit —';
    fit.dataset.state = V.fitState(result.fit);
    calls.dataset.state = V.callsState(result.analysis);
    calls.textContent = result.analysis?.status === 'calls' ? '✕ Есть звонки' : result.analysis?.status === 'no-calls' ? '✓ Без звонков' : '? Звонки неясно';

    const tooltip = V.analysisTitle(result);
    fit.title = tooltip;
    calls.title = tooltip;
    analyze.title = tooltip || analyze.title;
    analyze.textContent = 'Analysis';
    analyze.disabled = false;

    card.classList.toggle('vja-avito-card-strong', Number(score) >= 88);
    card.classList.toggle('vja-avito-card-calls', result.analysis?.status === 'calls');
    records.set(String(vacancy?.vacancyId || ''), result);
    applyFilter();
  }

  async function analyzeVacancy(card, vacancy, force = false) {
    const id = String(vacancy?.vacancyId || '');
    if (!id || running.has(`analysis:${id}`)) return records.get(id) || null;
    running.add(`analysis:${id}`);
    const bar = controls(card, vacancy);
    setWorking(bar, 'analyze', true, 'Читаю…');
    try {
      const result = await request('quick-list-full-analysis', { vacancy, force });
      if (!result || result.ok === false) throw new Error(result?.error || 'Не удалось проанализировать вакансию.');
      renderRecord(card, result);
      return result;
    } catch (error) {
      const button = bar.querySelector('[data-role="analyze"]');
      button.disabled = false;
      button.textContent = '↻ Повторить';
      button.title = error?.message || String(error);
      return null;
    } finally {
      running.delete(`analysis:${id}`);
    }
  }

  async function restore(card, vacancy) {
    const id = String(vacancy?.vacancyId || '');
    if (!id || records.has(id) || restoring.has(id)) return;
    restoring.add(id);
    try {
      const state = await request('quick-list-state', { vacancy });
      if (state?.ok === false) return;
      if (state?.analysis || state?.fit) renderRecord(card, { ...state, vacancy });
    } catch {} finally {
      restoring.delete(id);
    }
  }

  function notify(message, kind = '') {
    document.getElementById(ids.toast)?.remove();
    const toast = document.createElement('div');
    toast.id = ids.toast;
    toast.dataset.vjaRoot = 'avito-toast';
    toast.dataset.kind = kind;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.append(toast);
    setTimeout(() => toast.remove(), kind === 'bad' ? 9000 : 4800);
  }

  function chatComposerCandidates() {
    const selectors = [
      '[data-marker*="messenger"] textarea',
      '[data-marker*="messenger"] input',
      '[data-marker*="messenger"] [contenteditable="true"]',
      '[data-marker*="chat"] textarea',
      '[data-marker*="chat"] input',
      '[data-marker*="chat"] [contenteditable="true"]',
      'textarea[placeholder*="Сообщ"]',
      'input[placeholder*="Сообщ"]',
      'textarea[aria-label*="Сообщ"]',
      'input[aria-label*="Сообщ"]',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][data-marker*="input"]'
    ];
    const seen = new Set();
    const result = [];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el) || !visible(el) || el.closest('[data-vja-root]')) continue;
        const label = clean([el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('name')].filter(Boolean).join(' '));
        if (/поиск|search/i.test(label)) continue;
        seen.add(el);
        result.push(el);
      }
    }
    return result;
  }

  function chatRoot(composer) {
    if (!composer) return null;
    const direct = composer.closest('[data-marker*="messenger"],[data-marker*="chat"],[class*="messenger"],[class*="chat"],[role="dialog"],aside');
    if (direct) return direct;
    let node = composer.parentElement;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect?.();
      const style = getComputedStyle(node);
      if (rect && rect.width >= 280 && rect.height >= 220 && (style.position === 'fixed' || style.position === 'sticky' || /сообщени|chat/i.test(text(node, 3000)))) return node;
    }
    return composer.closest('form') || composer.parentElement || document.body;
  }

  function tokens(value) {
    const stop = new Set(['работа', 'удаленная', 'удалённая', 'специалист', 'оператор', 'менеджер', 'вакансия', 'company', 'remote', 'specialist', 'manager']);
    return [...new Set(clean(value).toLowerCase().match(/[a-zа-яё0-9]{4,}/gi) || [])].filter(token => !stop.has(token)).slice(0, 12);
  }

  function chatMatchesVacancy(rootNode, vacancy, beforeComposer = null) {
    if (!rootNode) return false;
    const value = clean(text(rootNode, 24000)).toLowerCase();
    const companyTokens = tokens(vacancy?.company || '');
    const titleTokens = tokens(vacancy?.title || '');
    if (companyTokens.some(token => value.includes(token))) return true;
    if (titleTokens.slice(0, 5).some(token => value.includes(token))) return true;
    return Boolean(beforeComposer && beforeComposer !== rootNode.querySelector('textarea,input,[contenteditable="true"]'));
  }

  function composerValue(el) {
    if (!el) return '';
    if ('value' in el) return String(el.value || '');
    return String(el.innerText || el.textContent || '');
  }

  function setNativeValue(el, value) {
    const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLInputElement ? HTMLInputElement.prototype : null;
    const setter = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else if ('value' in el) el.value = value;
  }

  async function setComposerValue(el, value) {
    const expected = String(value || '').trim();
    if (!el || !expected) return false;
    el.focus();
    if (el.isContentEditable) {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('insertText', false, expected);
      } catch {
        el.textContent = expected;
      }
    } else {
      setNativeValue(el, expected);
    }
    try {
      el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: expected }));
    } catch {}
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: expected }));
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(140);
    return clean(composerValue(el)) === clean(expected);
  }

  function sendButton(composer, rootNode) {
    const scope = rootNode || composer?.closest('form') || document;
    const explicitSelectors = [
      '[data-marker*="send-message"]',
      '[data-marker*="message-send"]',
      '[data-marker*="messenger"] button[type="submit"]',
      '[data-marker*="chat"] button[type="submit"]',
      'button[aria-label*="Отправ"]',
      'button[title*="Отправ"]',
      'button[type="submit"]'
    ];
    for (const selector of explicitSelectors) {
      const candidate = [...scope.querySelectorAll(selector)].find(el => visible(el) && !el.disabled && !el.closest('[data-vja-root]'));
      if (candidate) return candidate;
    }
    const byText = [...scope.querySelectorAll('button,[role="button"]')]
      .find(el => visible(el) && !el.disabled && /^(?:отправить|send)$/i.test(buttonLabel(el)) && !el.closest('[data-vja-root]'));
    if (byText) return byText;
    const form = composer?.closest('form');
    if (form) return [...form.querySelectorAll('button')].find(el => visible(el) && !el.disabled && (el.type === 'submit' || /отправ|send/i.test(buttonLabel(el)))) || null;
    return null;
  }

  function clickElement(el) {
    if (!el) return false;
    try { el.scrollIntoView?.({ block: 'center', inline: 'nearest' }); } catch {}
    try { el.focus?.({ preventScroll: true }); } catch {}
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch {}
    }
    el.click();
    return true;
  }

  async function revealWriteButton(card, vacancy) {
    let activeCard = card || findCard(vacancy);
    for (let attempt = 0; attempt < 18; attempt += 1) {
      if (activeCard) {
        markCard(activeCard, vacancy);
        emitHover(activeCard);
        const button = nativeWriteButton(activeCard);
        if (button) return button;
      } else if (V.isVacancyUrl(location.href)) {
        const button = nativeWriteButton(document);
        if (button) return button;
      }
      await wait(attempt < 5 ? 120 : 220);
      activeCard = findCard(vacancy) || activeCard;
    }
    return V.isVacancyUrl(location.href) ? nativeWriteButton(document) : null;
  }

  async function waitForMatchingComposer(vacancy, beforeComposer = null, timeout = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      for (const composer of chatComposerCandidates()) {
        const rootNode = chatRoot(composer);
        if (chatMatchesVacancy(rootNode, vacancy, beforeComposer)) return { composer, rootNode };
      }
      await wait(180);
    }
    return null;
  }

  async function pendingGet() {
    try { return (await chrome.storage.local.get(pendingKey))[pendingKey] || null; } catch { return null; }
  }

  async function pendingSet(value) {
    await chrome.storage.local.set({ [pendingKey]: value });
    return value;
  }

  async function pendingRemove() {
    try { await chrome.storage.local.remove(pendingKey); } catch {}
  }

  async function claimPending(pending) {
    const token = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const next = { ...pending, lockToken: token, lockUntil: Date.now() + 15000, status: 'sending' };
    await pendingSet(next);
    const current = await pendingGet();
    return current?.lockToken === token ? current : null;
  }

  async function completeApplication(pending) {
    if (!pending?.applicationId) return;
    await request('quick-list-complete', {
      id: pending.applicationId,
      appliedConfirmed: true,
      coverLetterSubmitted: true,
      employerAlreadyViewed: false
    }).catch(() => null);
  }

  async function sendPreparedMessage(pending, composer, rootNode) {
    const claimed = await claimPending(pending);
    if (!claimed) throw new Error('Отправку уже продолжает другая вкладка Avito.');
    let field = composer;
    let scope = rootNode;

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      if (!field?.isConnected || !visible(field)) {
        const found = await waitForMatchingComposer(claimed.vacancy, null, 2500);
        field = found?.composer || null;
        scope = found?.rootNode || null;
      }
      if (!field) throw new Error('Чат открылся, но поле сообщения Avito не найдено.');

      const filled = await setComposerValue(field, claimed.text);
      if (!filled) {
        await wait(250);
        continue;
      }

      let button = sendButton(field, scope);
      for (let waitIndex = 0; !button && waitIndex < 8; waitIndex += 1) {
        await wait(160);
        button = sendButton(field, scope);
      }
      if (!button) throw new Error('Письмо вставлено, но кнопка отправки Avito не найдена.');

      clickElement(button);
      await wait(650 + attempt * 120);

      const latestComposer = chatComposerCandidates().find(el => chatRoot(el) === scope) || chatComposerCandidates()[0] || null;
      const cleared = !latestComposer || !clean(composerValue(latestComposer));
      const exactOutsideComposer = scope && [...scope.querySelectorAll('[data-marker*="message"],[class*="message"]')]
        .filter(el => el !== latestComposer && !el.contains(latestComposer))
        .some(el => clean(text(el, 12000)).includes(clean(claimed.text).slice(0, 90)));

      if (cleared || exactOutsideComposer) {
        await completeApplication(claimed);
        await pendingRemove();
        notify('✓ Сопроводительное письмо отправлено в чат Avito.', 'ok');
        return { ok: true, attempts: attempt };
      }

      field = latestComposer;
      // Keep the lease while this explicit one-message send loop is active.
      // Releasing it here would let the periodic SPA scanner start a second
      // sender against the same chat before the current retries finish.
      await pendingSet({ ...claimed, attempts: attempt, status: 'sending', lockUntil: Date.now() + 15000 });
    }

    throw new Error('Avito не подтвердил отправку письма после нескольких попыток. Текст сохранён для безопасного повтора.');
  }

  function fallbackModal(vacancy, prepared, record, error, sourceCard) {
    document.getElementById(ids.modal)?.remove();
    const host = document.createElement('div');
    host.id = ids.modal;
    host.dataset.vjaRoot = 'avito-letter-modal';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', 'Сопроводительное письмо для Avito');

    const dialog = document.createElement('div');
    dialog.className = 'vja-avito-dialog';
    const heading = document.createElement('h2');
    heading.textContent = 'Письмо для Avito';
    const subtitle = document.createElement('p');
    subtitle.className = 'vja-avito-subtitle';
    subtitle.textContent = [vacancy.title, vacancy.company, record?.fit?.score != null ? `${Math.round(record.fit.score)}% Match` : '', record?.analysis?.status === 'calls' ? 'Есть звонки' : record?.analysis?.status === 'no-calls' ? 'Без звонков' : ''].filter(Boolean).join(' · ');
    const area = document.createElement('textarea');
    area.value = prepared.coverLetter || '';
    area.setAttribute('aria-label', 'Текст письма');
    const status = document.createElement('div');
    status.className = 'vja-avito-modal-status';
    status.dataset.kind = 'bad';
    status.textContent = error?.message || 'Письмо подготовлено. Нажмите «Отправить в чат», чтобы открыть чат Avito, вставить текст и отправить его.';

    const actions = document.createElement('div');
    actions.className = 'vja-avito-actions';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Закрыть';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Скопировать';
    const sendToChat = document.createElement('button');
    sendToChat.type = 'button';
    sendToChat.dataset.primary = '1';
    sendToChat.dataset.role = 'send-to-chat';
    sendToChat.textContent = 'Отправить в чат';
    sendToChat.title = 'Открыть точный чат этой вакансии Avito, вставить письмо и отправить его.';

    const persist = async () => {
      if (prepared.application?.id) await request('update-letter', { id: prepared.application.id, text: area.value, url: location.href }).catch(() => null);
    };

    close.addEventListener('click', () => host.remove());
    host.addEventListener('click', event => { if (event.target === host) host.remove(); });
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      try {
        await persist();
        await navigator.clipboard.writeText(area.value.trim());
        status.dataset.kind = 'ok';
        status.textContent = '✓ Письмо скопировано.';
      } catch (copyError) {
        status.dataset.kind = 'bad';
        status.textContent = copyError?.message || String(copyError);
      } finally {
        copy.disabled = false;
      }
    });
    sendToChat.addEventListener('click', async () => {
      sendToChat.disabled = true;
      copy.disabled = true;
      status.dataset.kind = '';
      status.textContent = 'Открываю точный чат Avito, вставляю письмо и отправляю…';
      try {
        const edited = area.value.trim();
        if (!edited) throw new Error('Письмо пустое. Добавьте текст перед отправкой.');
        await persist();
        const pending = {
          vacancy,
          text: edited,
          applicationId: prepared.application?.id || '',
          sourceUrl: location.href,
          createdAt: Date.now(),
          expiresAt: Date.now() + 5 * 60 * 1000,
          status: 'prepared'
        };
        await pendingSet(pending);
        await openChatAndSend(sourceCard, vacancy, pending);
        status.dataset.kind = 'ok';
        status.textContent = '✓ Письмо отправлено в чат Avito.';
        await wait(250);
        host.remove();
      } catch (sendError) {
        status.dataset.kind = 'bad';
        status.textContent = sendError?.message || String(sendError);
        sendToChat.disabled = false;
        copy.disabled = false;
      }
    });

    actions.append(close, copy, sendToChat);
    dialog.append(heading, subtitle, area, status, actions);
    host.append(dialog);
    document.body.append(host);
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }

  async function openChatAndSend(card, vacancy, pending) {
    // If the correct vacancy chat is already open, do not click another card.
    for (const composer of chatComposerCandidates()) {
      const rootNode = chatRoot(composer);
      if (chatMatchesVacancy(rootNode, vacancy, null)) {
        return sendPreparedMessage(pending, composer, rootNode);
      }
    }

    const beforeComposer = chatComposerCandidates()[0] || null;
    const native = await revealWriteButton(card, vacancy);
    if (!native) throw new Error('Не найдена штатная кнопка Avito «Написать» для этой вакансии. Нажмите «Отправить в чат» ещё раз после появления кнопки Avito.');

    clickElement(native);
    const found = await waitForMatchingComposer(vacancy, beforeComposer, 11000);
    if (!found) throw new Error('Avito не открыл точный чат выбранной вакансии. Нажмите «Отправить в чат» ещё раз — письмо сохранено.');
    return sendPreparedMessage(pending, found.composer, found.rootNode);
  }

  async function prepareAndSend(card, vacancy) {
    const id = String(vacancy?.vacancyId || '');
    if (!id || running.has(`letter:${id}`)) return;
    running.add(`letter:${id}`);
    const activeCard = card || findCard(vacancy);
    const bar = activeCard ? controls(activeCard, vacancy) : document.getElementById(ids.detail);
    setWorking(bar, 'letter', true, 'Отправляю…');

    let prepared = null;
    let record = records.get(id) || null;
    try {
      if (!record) {
        if (activeCard) record = await analyzeVacancy(activeCard, vacancy, false);
        else {
          const result = await request('quick-list-full-analysis', { vacancy, force: false });
          if (result?.ok !== false) {
            record = result;
            records.set(id, result);
          }
        }
      }

      prepared = await request('quick-list-prepare', { vacancy });
      if (!prepared || prepared.ok === false) throw new Error(prepared?.error || 'Не удалось подготовить письмо.');
      const letter = String(prepared.coverLetter || '').trim();
      if (!letter) throw new Error('Письмо не сформировано.');

      const pending = {
        vacancy,
        text: letter,
        applicationId: prepared.application?.id || '',
        sourceUrl: location.href,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000,
        status: 'prepared'
      };
      await pendingSet(pending);
      notify('Открываю точный чат Avito, вставляю письмо и отправляю…');
      await openChatAndSend(activeCard, vacancy, pending);
      setWorking(bar, 'letter', false, '✓ Отправлено');
    } catch (error) {
      setWorking(bar, 'letter', false, '↻ Письмо');
      notify(error?.message || 'Не удалось отправить письмо через Avito.', 'bad');
      if (prepared?.coverLetter) fallbackModal(vacancy, prepared, record, error, activeCard || document);
    } finally {
      running.delete(`letter:${id}`);
    }
  }

  async function resumePendingSend() {
    if (pendingResumeInFlight) return;
    const pending = await pendingGet();
    if (!pending) return;
    if (!pending.expiresAt || Date.now() > Number(pending.expiresAt)) {
      await pendingRemove();
      return;
    }
    if (pending.lockUntil && Date.now() < Number(pending.lockUntil)) return;

    const candidate = chatComposerCandidates().find(composer => chatMatchesVacancy(chatRoot(composer), pending.vacancy, null));
    if (!candidate) return;

    pendingResumeInFlight = true;
    try {
      await sendPreparedMessage(pending, candidate, chatRoot(candidate));
    } catch (error) {
      notify(error?.message || 'Не удалось продолжить отправку письма в Avito.', 'bad');
      await pendingSet({ ...pending, status: 'retry', lockToken: '', lockUntil: 0, lastError: error?.message || String(error) }).catch(() => null);
    } finally {
      pendingResumeInFlight = false;
    }
  }

  function ensureToolbar() {
    if (!V.isListUrl(location.href)) {
      document.getElementById(ids.toolbar)?.remove();
      return null;
    }
    let bar = document.getElementById(ids.toolbar);
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = ids.toolbar;
    bar.dataset.vjaRoot = 'avito-toolbar';

    const run = document.createElement('button');
    run.type = 'button';
    run.dataset.primary = '1';
    run.textContent = '⚡ Анализ страницы';

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Фильтр вакансий');
    for (const [value, label] of [['all', 'Все'], ['strong', 'Сильный Fit'], ['match', 'Fit ≥ 80%'], ['no-calls', 'Без звонков']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }

    const progress = document.createElement('span');
    progress.className = 'vja-avito-progress';
    progress.textContent = 'Avito BETA · 0 вакансий';

    run.addEventListener('click', () => void analyzePage(run, progress));
    select.addEventListener('change', () => {
      filter = select.value;
      applyFilter();
    });
    bar.append(run, select, progress);
    document.body.append(bar);
    return bar;
  }

  async function analyzePage(button, progress) {
    const token = ++batchToken;
    const items = V.uniqueVacancies(cards().map(card => extractVacancy(card)).filter(Boolean), 40);
    if (!items.length) {
      progress.textContent = 'Вакансии на странице не найдены';
      return;
    }

    button.disabled = true;
    button.textContent = 'Анализирую…';
    let done = 0;
    let failed = 0;
    let index = 0;

    const worker = async () => {
      while (token === batchToken) {
        const vacancy = items[index++];
        if (!vacancy) break;
        const card = findCard(vacancy);
        if (!card) {
          failed += 1;
          continue;
        }
        const result = await analyzeVacancy(card, vacancy, false);
        if (result) done += 1;
        else failed += 1;
        progress.textContent = `Avito BETA · ${done + failed}/${items.length}${failed ? ` · ошибок ${failed}` : ''}`;
        await wait(120);
      }
    };

    await Promise.all([worker(), worker()]);
    button.disabled = false;
    button.textContent = '⚡ Анализ страницы';
    progress.textContent = `Готово: ${done}/${items.length}${failed ? ` · ошибок ${failed}` : ''}`;
  }

  function applyFilter() {
    for (const card of cards()) {
      const vacancy = extractVacancy(card);
      const record = vacancy ? records.get(String(vacancy.vacancyId)) : null;
      card.dataset.vjaAvitoHidden = V.filterMatches(record, filter) ? '0' : '1';
    }
  }

  function ensureDetailPanel() {
    if (!V.isVacancyUrl(location.href)) {
      document.getElementById(ids.detail)?.remove();
      return;
    }
    const vacancy = currentDetailVacancy();
    if (!vacancy) return;

    let panel = document.getElementById(ids.detail);
    if (panel && panel.dataset.vacancyId === vacancy.vacancyId) return;
    panel?.remove();

    panel = document.createElement('div');
    panel.id = ids.detail;
    panel.dataset.vjaRoot = 'avito-detail';
    panel.dataset.vacancyId = vacancy.vacancyId;

    const name = document.createElement('strong');
    name.textContent = 'Avito BETA';
    const hint = document.createElement('small');
    hint.textContent = C.clip(vacancy.title, 80);
    const analysis = document.createElement('button');
    analysis.type = 'button';
    analysis.dataset.role = 'analyze';
    analysis.textContent = '✦ Analysis';
    const letter = document.createElement('button');
    letter.type = 'button';
    letter.dataset.role = 'letter';
    letter.dataset.primary = '1';
    letter.textContent = '✉ Письмо';
    const fit = document.createElement('span');
    fit.className = 'vja-avito-chip';
    fit.dataset.role = 'fit';
    fit.dataset.state = 'unknown';
    fit.textContent = 'Fit —';
    const calls = document.createElement('span');
    calls.className = 'vja-avito-chip';
    calls.dataset.role = 'calls';
    calls.dataset.state = 'unknown';
    calls.textContent = 'Звонки —';

    analysis.addEventListener('click', async () => {
      analysis.disabled = true;
      analysis.textContent = 'Читаю…';
      try {
        const result = await request('quick-list-full-analysis', { vacancy, force: true });
        if (result?.ok === false) throw new Error(result.error);
        records.set(vacancy.vacancyId, result);
        fit.textContent = `${Math.round(Number(result.fit?.score || 0))}% Match`;
        fit.dataset.state = V.fitState(result.fit);
        calls.textContent = result.analysis?.status === 'calls' ? '✕ Есть звонки' : result.analysis?.status === 'no-calls' ? '✓ Без звонков' : '? Звонки неясно';
        calls.dataset.state = V.callsState(result.analysis);
        const title = V.analysisTitle(result);
        fit.title = title;
        calls.title = title;
        analysis.title = title;
        analysis.textContent = 'Analysis';
      } catch (error) {
        analysis.textContent = '↻ Повторить';
        analysis.title = error?.message || String(error);
      } finally {
        analysis.disabled = false;
      }
    });
    letter.addEventListener('click', () => void prepareAndSend(null, vacancy));

    panel.append(name, hint, analysis, letter, fit, calls);
    document.body.append(panel);

    request('quick-list-state', { vacancy }).then(state => {
      if (state?.analysis || state?.fit) {
        records.set(vacancy.vacancyId, { ...state, vacancy });
        fit.textContent = state.fit?.score != null ? `${Math.round(Number(state.fit.score))}% Match` : 'Fit —';
        fit.dataset.state = V.fitState(state.fit);
        calls.textContent = state.analysis?.status === 'calls' ? '✕ Есть звонки' : state.analysis?.status === 'no-calls' ? '✓ Без звонков' : '? Звонки неясно';
        calls.dataset.state = V.callsState(state.analysis);
      }
    }).catch(() => {});
  }

  function scan() {
    installStyle();
    if (V.isListUrl(location.href)) {
      const list = cards();
      for (const card of list) {
        const vacancy = extractVacancy(card);
        if (!vacancy) continue;
        controls(card, vacancy);
        void restore(card, vacancy);
      }
      const toolbar = ensureToolbar();
      const progress = toolbar?.querySelector('.vja-avito-progress');
      if (progress && !/Готово|ошибок|\//.test(progress.textContent)) progress.textContent = `Avito BETA · ${list.length} вакансий`;
      ensureDetailPanel();
    } else {
      document.getElementById(ids.toolbar)?.remove();
      ensureDetailPanel();
    }
    void resumePendingSend();
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'vjaCopilotPage') return false;
    if (message.action === 'ping') {
      respond({ ok: true, provider: 'avito' });
      return false;
    }
    if (message.action === 'vacancy') {
      const vacancy = currentDetailVacancy();
      if (!vacancy) {
        respond({ ok: false, error: 'avito-vacancy-not-found', vacancy: null });
        return false;
      }
      if (message.expectedVacancyId && String(vacancy.vacancyId) !== String(message.expectedVacancyId)) {
        respond({ ok: false, error: 'wrong-vacancy', vacancy: null });
        return false;
      }
      respond({ ok: true, vacancy });
      return false;
    }
    if (message.action === 'inspect') {
      respond({
        ok: true,
        pageType: V.isVacancyUrl(location.href) ? 'JOB_DESCRIPTION' : V.isListUrl(location.href) ? 'JOB_LIST' : 'UNKNOWN',
        provider: 'avito'
      });
      return false;
    }
    return false;
  });

  const observer = new MutationObserver(mutations => {
    if (mutations.every(mutation => mutation.target instanceof Element && mutation.target.closest?.('[data-vja-root]'))) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 220);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });

  addEventListener('popstate', () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 80);
  });
  addEventListener('hashchange', () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 80);
  });

  const watch = setInterval(() => {
    if (document.visibilityState !== 'hidden') scan();
  }, 900);
  addEventListener('pagehide', () => clearInterval(watch), { once: true });

  root.vjaAvitoVacancies = {
    scan,
    extractVacancy,
    analyzeVacancy,
    prepareLetter: prepareAndSend,
    prepareAndSend,
    cards,
    setComposerValue,
    sendPreparedMessage,
    resumePendingSend
  };
  scan();
})(globalThis);
