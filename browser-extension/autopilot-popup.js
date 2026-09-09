(() => {
  const el=id=>document.getElementById(id);
  let status, busy=false;
  async function refresh() {
    if(busy)return;
    try {
      const api=await getApiBase();
      const response=await vjaFetch(`${api}/api/automation/status`);
      if(!response.ok)throw new Error(`Программа недоступна (${response.status}).`);
      status=await response.json();
      el('rocketAutopilot').textContent=status.autoApplyEnabled?'⏹ Остановить автопилот HH':'🚀 Запустить автопилот HH';
      el('rocketAutopilot').disabled=!status.autoApplyEnabled&&!status.allowed;
      el('rocketAutopilot').setAttribute('aria-pressed',String(Boolean(status.autoApplyEnabled)));
      const local=await chrome.storage.local.get('vjaHhDiscoveryBlocked');
      el('rocketStatus').textContent=`Порог ${status.autoApplyMinimumScore}/100 · сегодня ${status.appliedToday}/${status.dailyAutoApplyLimit}. `
        +(local.vjaHhDiscoveryBlocked||status.collection?.error||status.collection?.result?.errors?.join(' ')||status.lastMessage||'');
    } catch(error) {el('rocketStatus').textContent=error.message;}
  }
  el('rocketAutopilot').addEventListener('click',async()=>{
    if(busy)return;
    busy=true;el('rocketAutopilot').disabled=true;
    try {
      const api=await getApiBase();
      // Read current settings at the click, rather than overwriting dashboard edits with cached defaults.
      const currentResponse=await vjaFetch(`${api}/api/automation/status`);
      if(!currentResponse.ok)throw new Error('Не удалось прочитать настройки автопилота.');
      const current=await currentResponse.json();
      const response=await vjaFetch(`${api}/api/settings/autoapply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!current.autoApplyEnabled,minimumScore:current.autoApplyMinimumScore,dailyLimit:current.dailyAutoApplyLimit})});
      if(!response.ok)throw new Error(`Не удалось переключить автопилот (${response.status}).`);
      if(!current.autoApplyEnabled)void chrome.runtime.sendMessage({type:'vjaAutopilotControlWake'});
    } catch(error) {el('rocketStatus').textContent=error.message;}
    finally {busy=false;el('rocketAutopilot').disabled=false;await refresh();}
  });
  chrome.storage.sync.get('vjaHhBrowserSearch').then(s=>{el('browserSearchMode').checked=Boolean(s.vjaHhBrowserSearch);});
  el('browserSearchMode').addEventListener('change',async()=>{
    await chrome.storage.sync.set({vjaHhBrowserSearch:el('browserSearchMode').checked});
    void chrome.runtime.sendMessage({type:'vjaAutopilotControlWake'});
  });
  el('retryBrowserSearch').addEventListener('click',async()=>{
    await chrome.storage.local.remove(['vjaHhDiscoveryAt','vjaHhDiscoveryBlocked']);
    void chrome.runtime.sendMessage({type:'vjaAutopilotControlWake'});await refresh();
  });
  void refresh();setInterval(()=>void refresh(),10000);
})();
