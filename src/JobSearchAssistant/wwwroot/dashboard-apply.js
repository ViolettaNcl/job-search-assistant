const dashboardApplications = new Map();
function dashboardApplyButton(v) {
  const item=dashboardApplications.get(v.id),busy=['pending','unknown'].includes(item?.status),done=item?.status==='confirmed';
  return `<button class="primary" data-apply-id="${esc(v.id)}" ${busy||done?'disabled':''} onclick="applyJob('${esc(v.id)}')">${done?'Отклик и письмо отправлены':item?.status==='unknown'?'Проверьте результат':busy?'Отправляю…':'Откликнуться с письмом'}</button>`;
}
function dashboardApplyStatus(id) {
  const item=dashboardApplications.get(id);
  return item?`<p class="reason" role="status">${esc(item.message)}</p>`:'';
}
async function applyJob(id) {
  if(['pending','unknown','confirmed'].includes(dashboardApplications.get(id)?.status))return;
  const requestId=crypto.randomUUID();
  dashboardApplications.set(id,{requestId,status:'pending',message:'Готовлю отклик и письмо…'});renderJobs();
  if(state.automation?.apiReady) {
    try {await api(`/api/vacancies/${id}/apply-tailored`,{method:'POST'});dashboardApplications.set(id,{requestId,status:'confirmed',message:'Отклик и письмо отправлены.'});renderJobs();showNotice('Отклик и письмо отправлены.');void load().catch(e=>showNotice(e.message,false));}
    catch(error){dashboardApplications.set(id,{requestId,status:'review',message:error.message});renderJobs();}
    return;
  }
    const bridge=await checkDashboardBridge();
  if(!bridge.ok){dashboardApplications.set(id,{requestId,status:'review',message:bridge.message+' Запрос на отклик не отправлялся.'});renderJobs();return;}
  window.postMessage({type:'vjaDashboardApplyRequest',vacancyId:id,requestId},location.origin);
  setTimeout(()=>{
    const item=dashboardApplications.get(id);
    if(item?.requestId===requestId && !item.acknowledged && item.status==='pending') {
      item.status='unknown';item.message='Расширение приняло соединение, но результат запроса не подтверждён. Проверьте отклики HH перед повторной отправкой.';renderJobs();
    }
  },10000);
}
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.type!=='vjaDashboardApplyResult')return;
  const m=event.data,item=dashboardApplications.get(m.vacancyId);
  if(!item||item.requestId!==m.requestId||item.status==='confirmed')return;
  // A late acknowledgement must not overwrite a terminal failure or confirmation.
  if(item.acknowledged&&item.status==='review'&&m.status==='pending')return;
  if(!['pending','confirmed','review','unknown'].includes(m.status))return;
  Object.assign(item,{acknowledged:true,status:m.status,message:String(m.message||'Проверяю результат…')});renderJobs();
  if(m.status==='confirmed'){showNotice(item.message);void load().catch(e=>showNotice(e.message,false));}
});

const dashboardBridgeWaiters=new Map();
let dashboardBridgeCheck;
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.type!=='vjaDashboardBridgeReady')return;
  dashboardBridgeWaiters.get(event.data.requestId)?.(event.data);
});
function checkDashboardBridge() {
  if(dashboardBridgeCheck)return dashboardBridgeCheck;
  dashboardBridgeCheck=(async()=>{
    let result;
    for(let attempt=0;attempt<3;attempt++) {
      const requestId=crypto.randomUUID();
      result=await new Promise(resolve=>{
        const timer=setTimeout(()=>{dashboardBridgeWaiters.delete(requestId);resolve({ok:false});},1500);
        dashboardBridgeWaiters.set(requestId,value=>{clearTimeout(timer);dashboardBridgeWaiters.delete(requestId);resolve(value);});
        window.postMessage({type:'vjaDashboardBridgeHello',requestId},location.origin);
      });
      if(result.ok)break;
    }
    const message=result.ok?`Расширение ${result.version||''} подключено в этом браузере.`:
      result.message||'В этой вкладке расширение не подключено. Откройте дашборд через «Open dashboard» в расширении и разрешите ему доступ к локальному сайту.';
    const status=document.getElementById('dashboardBridgeStatus');if(status)status.textContent=message;
    return {...result,message};
  })().finally(()=>{dashboardBridgeCheck=null;});
  return dashboardBridgeCheck;
}
window.addEventListener('DOMContentLoaded',()=>{void checkDashboardBridge();});
window.addEventListener('focus',()=>{void checkDashboardBridge();});
