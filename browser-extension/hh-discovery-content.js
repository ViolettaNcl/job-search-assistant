// Read only ordinary, accessible HH pages. Never interact with login or challenge forms.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'vjaReadHhDiscovery' || window.top !== window) return false;
  if (!/(^|\.)hh\.ru$/.test(location.hostname)) { respond({blocked:'Открыта страница вне HH.'}); return false; }
  const text = document.body?.innerText || '';
  if (/captcha|account\/login|\/security\//i.test(location.pathname)
      || document.querySelector('input[name*="captcha"], iframe[src*="captcha"], [data-qa="account-login-submit"]')
      || /VPN мешает|подтвердите, что вы|доступ ограничен|слишком много запросов|verify you are human/i.test(text)) {
    respond({blocked:'HH требует входа или проверки безопасности. Выполните её самостоятельно в открытой вкладке.'}); return false;
  }
  if (message.expectedUrl && !self.vjaHhNavigation.sameTask(message.expectedUrl,location.href)) {respond({blocked:'Адрес страницы не соответствует запрошенной вакансии или поиску.'});return false;}
  const pageUrl=location.href;
  const path=location.pathname.replace(/\/+$/,'');
  if (path === '/search/vacancy') {
    const links = [...document.querySelectorAll('a[data-qa="serp-item__title"], a[data-qa="vacancy-serp__vacancy-title"]')]
      .map(a => {try {const u = new URL(a.href);return /(^|\.)hh\.ru$/.test(u.hostname) && /^\/vacancy\/\d+\/?$/.test(u.pathname) ? u.origin+u.pathname : null;}catch{return null;}}).filter(Boolean);
    respond({pageUrl,links:[...new Set(links)].slice(0,10),emptyConfirmed:links.length===0&&Boolean(document.querySelector('[data-qa=\"vacancy-serp__results\"]'))&&/ничего не найдено|вакансии не найдены/i.test(text)}); return false;
  }
  if (/^\/vacancy\/\d+$/.test(path)) {
    if (/Резюме доставлено|Вы откликнулись|Вы уже откликались/.test(text)) {respond({pageUrl,alreadyApplied:true});return false;}
    const vacancy = extractPage();
    // Recommendations elsewhere on the page can mention remote work; they do not define this vacancy.
    const structured = window.vjaAtsStructured?.readStructuredJobPosting?.(document);
    const description = vacancy.description || '';
    const explicitlyOnsite = /не (?:предусмотрен[ао]? |рассматриваем )?удал[её]н|no remote|not remote|onsite only|только (?:в )?офис/i.test(description);
    vacancy.remote = !explicitlyOnsite && Boolean(structured?.remote || /удал[её]нн|remote|work from (?:home|anywhere)/i.test(description));
    vacancy.remoteScope = vacancy.remote ? 'Remote stated in vacancy description or structured data' : '';

    if (!vacancy.title || (vacancy.description || '').length < 80) respond({blocked:'Не удалось прочитать описание HH. Нужна ручная проверка страницы.'});
    else respond({pageUrl,vacancy});
    return false;
  }
  respond({blocked:'HH перенаправил на другую страницу. Проверьте открытую вкладку.'}); return false;
});
