(() => {
  const el=id=>document.getElementById(id);let status=null,busy=false;
  const defaults={programmingOnly:true,remoteOnly:true,sessionLimit:5,searchQueries:['Junior C# .NET','Junior ASP.NET Core','Junior Backend C#','Junior Full-Stack .NET','Junior QA Automation C#','Junior Manual QA','Technical Support remote']};
  async function localPrefs(){const s=await chrome.storage.sync.get(['vjaAutopilotPreferences','vjaHhBrowserSearch']);return {...defaults,...(s.vjaAutopilotPreferences||{}),browserSearch:s.vjaHhBrowserSearch!==false};}
  async function refresh(){
    if(busy)return;
    try{
      const prefs=await localPrefs();el('autoSessionLimit').value=prefs.sessionLimit||5;el('browserSearchMode').checked=prefs.browserSearch;el('autoSearchQueries').value=(prefs.searchQueries||defaults.searchQueries).join('\n');
      const api=await getApiBase(),response=await vjaFetch(`${api}/api/automation/status`);if(!response.ok)throw new Error(`Программа недоступна (${response.status}).`);
      status=await response.json();el('autoMinScore').value=status.autoApplyMinimumScore??80;el('autoDailyLimit').value=status.dailyAutoApplyLimit??15;
      el('rocketAutopilot').textContent=status.autoApplyEnabled?'⏹ Остановить автопилот':'🚀 Запустить автопилот';el('rocketAutopilot').disabled=!status.autoApplyEnabled&&!status.allowed;el('rocketAutopilot').setAttribute('aria-pressed',String(Boolean(status.autoApplyEnabled)));
      const local=await chrome.storage.local.get('vjaHhDiscoveryBlocked');const issue=local.vjaHhDiscoveryBlocked||status.collection?.error||status.collection?.result?.errors?.join(' ')||status.lastMessage||'';
      el('rocketStatus').textContent=`Порог ${status.autoApplyMinimumScore}/100 · сегодня ${status.appliedToday}/${status.dailyAutoApplyLimit}. ${issue}`.trim();
    }catch(error){el('rocketStatus').textContent=error.message;}
  }
  async function saveSettings(){
    const minimumScore=Math.max(60,Math.min(100,Number(el('autoMinScore').value)||80)),dailyLimit=Math.max(1,Math.min(100,Number(el('autoDailyLimit').value)||15)),sessionLimit=Math.max(1,Math.min(20,Number(el('autoSessionLimit').value)||5));
    const searchQueries=String(el('autoSearchQueries').value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,12);const prefs={...defaults,sessionLimit,searchQueries:searchQueries.length?searchQueries:defaults.searchQueries};await chrome.storage.sync.set({vjaAutopilotPreferences:prefs,vjaHhBrowserSearch:Boolean(el('browserSearchMode').checked)});
    const api=await getApiBase();const response=await vjaFetch(`${api}/api/settings/autoapply/preferences`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({minimumScore,dailyLimit})});if(!response.ok)throw new Error(`Не удалось сохранить настройки (${response.status}).`);
    return {minimumScore,dailyLimit,sessionLimit};
  }
  el('saveAutopilotSettings')?.addEventListener('click',async()=>{try{busy=true;const x=await saveSettings();el('rocketStatus').textContent=`Сохранено: от ${x.minimumScore}/100, до ${x.dailyLimit} в день и ${x.sessionLimit} за сессию.`;}catch(e){el('rocketStatus').textContent=e.message;}finally{busy=false;await refresh();}});
  el('rocketAutopilot')?.addEventListener('click',async()=>{
    if(busy)return;busy=true;el('rocketAutopilot').disabled=true;
    try{
      const saved=await saveSettings();const api=await getApiBase(),currentResponse=await vjaFetch(`${api}/api/automation/status`);if(!currentResponse.ok)throw new Error('Не удалось прочитать состояние автопилота.');const current=await currentResponse.json();
      const enabled=!current.autoApplyEnabled;if(enabled&&!confirm(`Запустить автопилот?\n\nТолько удалённые programming-вакансии\nПорог: ${saved.minimumScore}/100\nЛимит: ${saved.dailyLimit} в день · ${saved.sessionLimit} за сессию\n\nАвтопилот сам отправляет отклики и сопроводительные письма на подходящие вакансии.`))return;
      const response=await vjaFetch(`${api}/api/settings/autoapply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled,minimumScore:saved.minimumScore,dailyLimit:saved.dailyLimit})});if(!response.ok)throw new Error(`Не удалось переключить автопилот (${response.status}).`);
      if(enabled){if(chrome.storage.session?.remove)await chrome.storage.session.remove('vjaAutopilotSession').catch(()=>{});await chrome.storage.local.remove(['vjaHhDiscoveryAt','vjaHhDiscoveryBlocked']);void chrome.runtime.sendMessage({type:'vjaAutopilotControlWake'});}
    }catch(error){el('rocketStatus').textContent=error.message;}finally{busy=false;el('rocketAutopilot').disabled=false;await refresh();}
  });
  el('browserSearchMode')?.addEventListener('change',async()=>{await chrome.storage.sync.set({vjaHhBrowserSearch:el('browserSearchMode').checked});if(status?.autoApplyEnabled)void chrome.runtime.sendMessage({type:'vjaAutopilotControlWake'});});
  el('retryBrowserSearch')?.addEventListener('click',async()=>{await chrome.storage.local.remove(['vjaHhDiscoveryAt','vjaHhDiscoveryBlocked']);void chrome.runtime.sendMessage({type:'vjaAutopilotControlWake'});await refresh();});
  void refresh();setInterval(()=>void refresh(),10000);
})();
