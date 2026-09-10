(() => {
  if(window.top!==window || !['localhost','127.0.0.1','[::1]'].includes(location.hostname) || !['/','/index.html'].includes(location.pathname))return;
  // Reinjection replaces listeners instead of duplicating application requests.
  window.vjaDashboardBridgeCleanup?.();
  const post=message=>window.postMessage(message,location.origin);
  async function onPage(event) {
    if(event.source!==window || event.origin!==location.origin)return;
    const {type,vacancyId,requestId}=event.data||{};
    if(!['vjaDashboardApplyRequest','vjaDashboardBridgeHello'].includes(type))return;
    if(!chrome.runtime?.id){cleanup();return;}
    const hello=type==='vjaDashboardBridgeHello';
    try {
      const response=await chrome.runtime.sendMessage({type:hello?type:'vjaDashboardApply',vacancyId,requestId});
      if(hello)post({type:'vjaDashboardBridgeReady',requestId,ok:response?.ok===true,version:response?.version,message:response?.message});
      else post({type:'vjaDashboardApplyResult',vacancyId,requestId,status:response?.ok?'pending':'review',message:response?.ok?'Запрос передан расширению.':response?.message||'Расширение не приняло запрос.'});
    } catch {
      if(hello)post({type:'vjaDashboardBridgeReady',requestId,ok:false,message:'Связь с расширением прервана. Проверяю подключение…'});
      // After dispatch, delivery is unknown: do not invite an immediate duplicate click.
      else post({type:'vjaDashboardApplyResult',vacancyId,requestId,status:'unknown',message:'Связь прервалась после передачи запроса. Проверьте отклики HH перед повторной отправкой.'});
    }
  }
  function onRuntime(message,_sender,respond) {
    if(message?.type==='vjaDashboardBridgePing'){respond({ok:true});return false;}
    if(message?.type==='vjaDashboardApplyResult')post(message);
    return false;
  }
  function cleanup(){window.removeEventListener('message',onPage);try{chrome.runtime.onMessage.removeListener(onRuntime);}catch{}}
  window.vjaDashboardBridgeCleanup=cleanup;
  window.addEventListener('message',onPage);
  chrome.runtime.onMessage.addListener(onRuntime);
})();
