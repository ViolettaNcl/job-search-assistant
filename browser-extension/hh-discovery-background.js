async function discoverHhInBrowser(api, status, afterImport) {
  const settings = await chrome.storage.local.get(['vjaHhDiscoveryAt','vjaHhDiscoveryQuery','vjaHhDiscoveryBlocked','vjaHhDiscoveryMessage']);
  // One-time recovery of 2.7.2's exact-string redirect bug. Real challenge errors are retained.
  if (settings.vjaHhDiscoveryBlocked===self.vjaHhNavigation.legacyRedirect) {
    await chrome.storage.local.remove(['vjaHhDiscoveryBlocked','vjaHhDiscoveryAt']);
    settings.vjaHhDiscoveryBlocked='';settings.vjaHhDiscoveryAt=0;
  }
  if (settings.vjaHhDiscoveryBlocked) return settings.vjaHhDiscoveryBlocked;
  if (Date.now()-(settings.vjaHhDiscoveryAt||0)<30*60*1000) return settings.vjaHhDiscoveryMessage||'';
  const queries = status.browserSearchQueries?.length ? status.browserSearchQueries : ['Junior C# .NET'];
  const index = (settings.vjaHhDiscoveryQuery||0)%queries.length;
  await chrome.storage.local.set({vjaHhDiscoveryAt:Date.now(),vjaHhDiscoveryQuery:index+1});
  const search = new URL('https://hh.ru/search/vacancy');
  search.searchParams.set('text',queries[index]);search.searchParams.set('order_by','publication_time');
  if(status.remoteOnly)search.searchParams.set('schedule','remote');
  let tab, imported=0, keep=false;
  try {
    const old = await chrome.storage.local.get('vjaHhDiscoveryTab');
    if(old.vjaHhDiscoveryTab) {try {await chrome.tabs.remove(old.vjaHhDiscoveryTab);}catch{}}
    tab = await chrome.tabs.create({url:search.href,active:false});
    await chrome.storage.local.set({vjaHhDiscoveryTab:tab.id});
    const read = async (expectedUrl) => {
      const started=Date.now();
      while(Date.now()-started<30000) {
        const current=await chrome.tabs.get(tab.id);
        if(current.status==='complete' && self.vjaHhNavigation.sameTask(expectedUrl,current.url))break;
        if(current.status==='complete' && !self.vjaHhNavigation.sameTask(expectedUrl,current.url) && Date.now()-started>2000)throw new Error('HH открыл страницу входа, проверки или другой задачи. Проверьте открытую вкладку.');
        await browserAutopilotWait(400);
      }
      const current=await chrome.tabs.get(tab.id);
      if(current.status!=='complete'||!self.vjaHhNavigation.sameTask(expectedUrl,current.url))throw new Error('Страница HH не загрузилась за 30 секунд.');
      await browserAutopilotWait(1000);
      let timer,r;
      try {r=await Promise.race([chrome.tabs.sendMessage(tab.id,{type:'vjaReadHhDiscovery',expectedUrl},{frameId:0}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Страница HH не ответила за 10 секунд.')),10000);})]);}
      finally {clearTimeout(timer);}
      if(r?.blocked)throw new Error(r.blocked);
      const after=await chrome.tabs.get(tab.id);
      if(!self.vjaHhNavigation.sameTask(expectedUrl,after.url)||!self.vjaHhNavigation.sameTask(expectedUrl,r?.pageUrl))throw new Error('Страница изменилась во время чтения. Поиск остановлен без импорта.');
      return r;
    };
    const results=await read(search.href);
    if(results?.emptyConfirmed){const message='По этому запросу HH не нашёл вакансий. Следующий запрос будет проверен по расписанию.';await chrome.storage.local.set({vjaHhDiscoveryMessage:message});return message;}
    if(!results?.links?.length)throw new Error('В выдаче HH нет доступных карточек, либо изменилась страница. Проверьте вкладку поиска.');
    for(const url of results.links.slice(0,10)) {
      const live=await browserAutopilotJson(`${api}/api/automation/status`);
      const config=await chrome.storage.sync.get('vjaHhBrowserSearch');
      if(!self.vjaBrowserAutopilot.shouldRun(live)||!config.vjaHhBrowserSearch)break;
      await browserAutopilotHeartbeat(api,false,`Читаю вакансии через сайт HH: ${imported} сохранено.`);
      await chrome.tabs.update(tab.id,{url});
      const r=await read(url);if(r?.alreadyApplied)continue;
      if(!r?.vacancy)throw new Error('HH не вернул читаемую вакансию.');
      if(!self.vjaBrowserAutopilot.hasSafeSeniority(r.vacancy.title))continue;
      await browserAutopilotJson(`${api}/api/import/browser`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r.vacancy)});
      imported++;
      // Qualify and apply before reading the next card; unresolved submissions retain their plan.
      if (afterImport && await afterImport() === false) break;
      await browserAutopilotWait(2000);
    }
    const message=`Поиск через сайт HH: проверено и сохранено ${imported} вакансий. Следующий поисковый запрос — через 30 минут.`;
    await chrome.storage.local.set({vjaHhDiscoveryMessage:message});
    return message;
  } catch(error) {
    keep=true;
    const message=`Поиск через сайт HH остановлен: ${error.message}`;
    await chrome.storage.local.set({vjaHhDiscoveryBlocked:message});
    if(tab?.id)await chrome.tabs.update(tab.id,{active:true}).catch(()=>{});
    return message;
  } finally {
    if(tab?.id&&!keep)await chrome.tabs.remove(tab.id).catch(()=>{});
    if(!keep)await chrome.storage.local.remove('vjaHhDiscoveryTab');
  }
}
