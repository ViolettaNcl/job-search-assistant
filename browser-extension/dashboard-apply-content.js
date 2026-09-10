(() => {
  if(window.top!==window || !['localhost','127.0.0.1','[::1]'].includes(location.hostname) || !['/','/index.html'].includes(location.pathname))return;
  window.addEventListener('message', async event=>{
    if(event.source!==window || event.origin!==location.origin || event.data?.type!=='vjaDashboardApplyRequest')return;
    const {vacancyId,requestId}=event.data;
    try {
      const response=await chrome.runtime.sendMessage({type:'vjaDashboardApply',vacancyId,requestId});
      window.postMessage({type:'vjaDashboardApplyResult',vacancyId,requestId,status:response?.ok?'pending':'review',message:response?.ok?'Запрос передан расширению.':response?.message||'Расширение не ответило.'},location.origin);
    } catch {window.postMessage({type:'vjaDashboardApplyResult',vacancyId,requestId,status:'review',message:'Обновите расширение и перезагрузите дашборд.'},location.origin);}
  });
  chrome.runtime.onMessage.addListener(message=>{
    if(message?.type==='vjaDashboardApplyResult')window.postMessage(message,location.origin);
  });
})();
