const dashboardApplications = new Map();
function dashboardApplyButton(v) {
  const item=dashboardApplications.get(v.id),busy=item?.status==='pending',done=item?.status==='confirmed';
  return `<button class="primary" data-apply-id="${esc(v.id)}" ${busy||done?'disabled':''} onclick="applyJob('${esc(v.id)}')">${done?'Отклик и письмо отправлены':busy?'Отправляю…':'Откликнуться с письмом'}</button>`;
}
function dashboardApplyStatus(id) {
  const item=dashboardApplications.get(id);
  return item?`<p class="reason" role="status">${esc(item.message)}</p>`:'';
}
async function applyJob(id) {
  if(['pending','confirmed'].includes(dashboardApplications.get(id)?.status))return;
  const requestId=crypto.randomUUID();
  dashboardApplications.set(id,{requestId,status:'pending',message:'Готовлю отклик и письмо…'});renderJobs();
  if(state.automation?.apiReady) {
    try {await api(`/api/vacancies/${id}/apply-tailored`,{method:'POST'});dashboardApplications.set(id,{requestId,status:'confirmed',message:'Отклик и письмо отправлены.'});renderJobs();showNotice('Отклик и письмо отправлены.');void load().catch(e=>showNotice(e.message,false));}
    catch(error){dashboardApplications.set(id,{requestId,status:'review',message:error.message});renderJobs();}
    return;
  }
  window.postMessage({type:'vjaDashboardApplyRequest',vacancyId:id,requestId},location.origin);
  setTimeout(()=>{
    const item=dashboardApplications.get(id);
    if(item?.requestId===requestId && !item.acknowledged && item.status==='pending') {
      item.status='review';item.message='Расширение не ответило. Обновите расширение и перезагрузите дашборд.';renderJobs();
    }
  },10000);
}
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.type!=='vjaDashboardApplyResult')return;
  const m=event.data,item=dashboardApplications.get(m.vacancyId);
  if(!item||item.requestId!==m.requestId||item.status==='confirmed')return;
  // A late acknowledgement must not overwrite a terminal failure or confirmation.
  if(item.acknowledged&&item.status==='review'&&m.status==='pending')return;
  if(!['pending','confirmed','review'].includes(m.status))return;
  Object.assign(item,{acknowledged:true,status:m.status,message:String(m.message||'Проверяю результат…')});renderJobs();
  if(m.status==='confirmed'){showNotice(item.message);void load().catch(e=>showNotice(e.message,false));}
});
