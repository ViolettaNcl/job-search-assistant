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
  if (location.pathname === '/search/vacancy') {
    const links = [...document.querySelectorAll('a[data-qa="serp-item__title"], a[data-qa="vacancy-serp__vacancy-title"]')]
      .map(a => {try {const u = new URL(a.href);return /(^|\.)hh\.ru$/.test(u.hostname) && /^\/vacancy\/\d+$/.test(u.pathname) ? u.origin+u.pathname : null;}catch{return null;}}).filter(Boolean);
    respond({links:[...new Set(links)].slice(0,10), empty:links.length===0}); return false;
  }
  if (/^\/vacancy\/\d+$/.test(location.pathname)) {
    if (/Резюме доставлено|Вы откликнулись|Вы уже откликались/.test(text)) {respond({alreadyApplied:true});return false;}
    const vacancy = extractPage();
    if (!vacancy.title || (vacancy.description || '').length < 80) respond({blocked:'Не удалось прочитать описание HH. Нужна ручная проверка страницы.'});
    else respond({vacancy});
    return false;
  }
  respond({blocked:'HH перенаправил на другую страницу. Проверьте открытую вкладку.'}); return false;
});
