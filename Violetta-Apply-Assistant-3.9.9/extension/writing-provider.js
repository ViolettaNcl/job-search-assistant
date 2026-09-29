/* Optional model transport; secrets never leave the extension worker except to the configured endpoint. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaWritingProvider=api;})(globalThis,function(){
 'use strict';
 function endpoint(raw){
  const u=new URL(String(raw||''));
  if(u.username||u.password||u.search||u.hash)throw new Error('URL модели не должен содержать логин, ключ или параметры.');
  const loop=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='https:'&&!(loop&&u.protocol==='http:'))throw new Error('Для внешней модели требуется HTTPS.');
  if(!/\/chat\/completions\/?$/.test(u.pathname))throw new Error('Укажите полный endpoint /chat/completions.');
  return u.toString();
 }
 function parse(content){
  if(typeof content!=='string'||content.length>40000)throw new Error('Некорректный ответ модели.');
  const cleaned=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const x=JSON.parse(cleaned);
  if(!x||typeof x.text!=='string'||!Array.isArray(x.factIds)||!Array.isArray(x.answeredQuestions)||!Array.isArray(x.missingFacts))throw new Error('Модель не вернула требуемую структуру ответа.');
  if(x.text.length>12000)throw new Error('Слишком длинный ответ модели.');
  return {text:x.text.trim(),factIds:x.factIds.filter(id=>typeof id==='string').slice(0,30),answeredQuestions:x.answeredQuestions.filter(id=>typeof id==='string').slice(0,30),missingFacts:x.missingFacts.filter(m=>m&&typeof m.questionId==='string').slice(0,30).map(m=>({questionId:m.questionId,reason:String(m.reason||'').slice(0,1000)})),source:'configured-ai'};
 }
 async function complete(prompt,{chromeApi=globalThis.chrome,fetchFn=globalThis.fetch,repair=null}={}){
  const settings=(await chromeApi.storage.local.get('vjaWritingProvider')).vjaWritingProvider||{mode:'local'};
  if(settings.mode!=='custom')return {available:false,reason:'local-mode'};
  if(settings.consent!==true)throw new Error('Разрешите отправку выбранных фактов и текущего диалога модели в настройках.');
  const url=endpoint(settings.endpoint),origin=new URL(url).origin+'/*';
  if(!await chromeApi.permissions.contains({origins:[origin]}))throw new Error('Нет разрешения на адрес модели. Откройте AI и ответы → Модель.');
  if(!String(settings.model||'').trim())throw new Error('Не указана модель.');
  const session=(await chromeApi.storage.session.get('vjaWritingApiKey')).vjaWritingApiKey||'';
  const local=(await chromeApi.storage.local.get('vjaWritingApiKey')).vjaWritingApiKey||'';
  const key=session||local;
  if(!key&&!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname))throw new Error('Добавьте API-ключ в настройках модели.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const messages=[{role:'system',content:prompt.system},{role:'user',content:JSON.stringify(prompt.payload)}];
   if(repair)messages.push({role:'user',content:'Previous draft rejected by local checks. Regenerate using only supplied facts. Checks: '+repair.join(', ')});
   const response=await fetchFn(url,{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json',...(key?{'Authorization':'Bearer '+key}:{})},body:JSON.stringify({model:settings.model,messages,temperature:0.35,max_tokens:900,stream:false,response_format:{type:'json_object'}})});
   if(!response.ok)throw new Error(`Модель недоступна: HTTP ${response.status}. Проверьте настройки / квоту; ключ не выводится в лог.`);
   const data=await response.json();return {available:true,...parse(data.choices?.[0]?.message?.content)};
  }catch(e){if(e.name==='AbortError')throw new Error('Модель не ответила за 25 секунд.');throw e;}finally{clearTimeout(timer);}
 }
 return {endpoint,parse,complete};
});
