/* Trusted extension settings: source review, model credentials, no employer actions. */
(async function(){
 'use strict';
 const request=(op,args={})=>chrome.runtime.sendMessage({type:'vjaCopilot',op,...args});
 const data=await request('memory');if(!data?.ok)throw new Error(data?.error||'Память недоступна.');
 const profile=data.profile,host=document.getElementById('profileMount')||document.querySelector('main');
 const el=(tag,text)=>{const x=document.createElement(tag);if(text)x.textContent=text;return x;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const details=el('details');details.className='group';details.id='truthMemory380';details.append(el('summary','Память CV и HH · источники и проверка'));
 details.append(el('p',`${profile.facts.length} фактов · версия источников ${profile.seedRevision||'не указана'}. Используются только подтверждённые сведения. Переписка не становится фактом профиля автоматически.`));
 for(const source of profile.sources||[])details.append(el('p',`${source.name} · ${source.receivedAt||''} · ${source.verification||source.type}`));
 if(profile.archivedFacts?.length)details.append(el('p',`${profile.archivedFacts.length} старых импортированных фактов сохранены в архиве и не используются до повторного подтверждения.`));
 details.append(el('p','Новое подтверждение: вставьте JSON-массив фактов {id, kind, text, textEn, roles, topics}. Используйте существующий id для исправления факта. Изменения сначала показываются для проверки.'));
 const raw=el('textarea');raw.rows=5;raw.setAttribute('aria-label','Новые факты из CV или HH');raw.placeholder='[{"id":"my-fact","kind":"experience","text":"Подтвержденный факт","roles":["developer"]}]';details.append(raw);
 const preview=el('div'),sourceStatus=el('p');sourceStatus.setAttribute('role','status');let rows=[],source=null,proposal=[];
 details.append(button('Проверить новые факты',async()=>{
  try{rows=JSON.parse(raw.value);if(!Array.isArray(rows)||!rows.every(f=>typeof f.text==='string'&&typeof f.id==='string'))throw new Error('Нужен массив фактов с id и text.');
   source={id:'user-reviewed-'+Date.now(),name:'Проверенные пользователем данные CV/HH',type:'user-confirmed',receivedAt:new Date().toISOString()};
   const r=await request('source-preview',{facts:rows,source});if(!r.ok)throw new Error(r.error);proposal=r.proposal;preview.replaceChildren();
   for(const item of proposal){const label=el('label'),checkbox=el('input');checkbox.type='checkbox';checkbox.value=item.fact.id;label.append(checkbox,document.createTextNode(`${item.action==='conflict'?'Замена: было «'+item.previous.text+'» →':'Добавление:'} ${item.fact.text}`));preview.append(label,el('br'));}
   sourceStatus.textContent='Отметьте только проверенные факты. Несовпадения не принимаются автоматически.';
  }catch(e){sourceStatus.textContent=e.message;}
 }));
 details.append(preview,button('Подтвердить отмеченные факты',async()=>{try{const acceptedIds=[...preview.querySelectorAll('input:checked')].map(x=>x.value);if(!acceptedIds.length)throw new Error('Ничего не выбрано.');const r=await request('source-accept',{facts:rows,source,acceptedIds});if(!r.ok)throw new Error(r.error);sourceStatus.textContent='Память обновлена. Перезагрузите настройки перед дальнейшим редактированием профиля.';raw.value='';preview.replaceChildren();}catch(e){sourceStatus.textContent=e.message;}}),sourceStatus);
 host.append(details);
 const check=el('details');check.className='group';check.append(el('summary','Проверить сопроводительное письмо без отправки'));
 const title=el('input');title.placeholder='Название вакансии';title.setAttribute('aria-label','Название тестовой вакансии');const desc=el('textarea');desc.rows=5;desc.placeholder='Полное описание вакансии';desc.setAttribute('aria-label','Описание тестовой вакансии');const output=el('pre');output.style.whiteSpace='pre-wrap';output.setAttribute('aria-live','polite');
 check.append(title,desc,button('Проанализировать и показать письмо',async()=>{try{output.textContent='Анализирую…';const r=await request('preview-letter',{vacancy:{title:title.value,description:desc.value,descriptionCoverage:'user-pasted',url:'https://preview.invalid/job/local'}});if(!r.ok)throw new Error(r.error);output.textContent=r.text+'\n\nИсточник: '+r.source+'\nИспользованы факты: '+r.factIds.join(', ')+'\nНикакой отклик не отправлен.';}catch(e){output.textContent=e.message;}}),output);host.append(check);
 const aiHost=document.getElementById('aiMount')||host,model=el('details');model.className='group';model.id='writingProvider380';model.append(el('summary','Модель для свободных ответов и редактирования'));
 model.append(el('p','Без внешней модели работают локальные письма и ответы по подтверждённым фактам. Свободное редактирование и сложные вопросы требуют настроенной модели. Старый шаблонный ответ backend больше не выдаётся за анализ диалога.'));
 const mode=el('select');mode.setAttribute('aria-label','Режим генерации');for(const [value,label] of [['local','Локальные подтверждённые факты'],['custom','Совместимый Chat Completions API']]){const o=el('option',label);o.value=value;mode.append(o);}mode.value=data.writingProvider.mode||'local';
 function field(label,value,type='text'){const l=el('label',label),i=el('input');i.type=type;i.value=value||'';i.setAttribute('aria-label',label);l.append(i);model.append(l);return i;}
 model.append(mode);const endpoint=field('Endpoint модели',data.writingProvider.endpoint||'https://openrouter.ai/api/v1/chat/completions','url');const name=field('Идентификатор модели',data.writingProvider.model||'');const key=field('API-ключ (только на текущий сеанс браузера)','','password');key.autocomplete='new-password';
 const label=el('label'),consent=el('input');consent.type='checkbox';consent.checked=data.writingProvider.consent===true;label.append(consent,document.createTextNode('Разрешаю передавать этой модели выбранные факты CV/HH, текст вакансии и текущую переписку. Возможны расходы по тарифу провайдера.'));model.append(label);
 const status=el('p');status.setAttribute('role','status');
 model.append(button('Сохранить модель',async()=>{try{
  if(mode.value==='custom'){
   const url=globalThis.vjaWritingProvider.endpoint(endpoint.value);if(!name.value.trim())throw new Error('Укажите модель.');if(!consent.checked)throw new Error('Нужно согласие на обработку данных.');
   const origin=new URL(url).origin+'/*';if(!await chrome.permissions.request({origins:[origin]}))throw new Error('Доступ к провайдеру не разрешён.');
   if(key.value.trim())await chrome.storage.session.set({vjaWritingApiKey:key.value.trim()});
   await chrome.storage.local.set({vjaWritingProvider:{mode:'custom',endpoint:url,model:name.value.trim(),consent:true,updatedAt:Date.now()}});
   key.value='';status.textContent='Сохранено. Ключ находится только в памяти сеанса браузера; после перезапуска его нужно ввести снова.';
  }else{await chrome.storage.local.set({vjaWritingProvider:{mode:'local',updatedAt:Date.now()}});status.textContent='Включён локальный режим. Внешние запросы модели отключены.';}
 }catch(e){status.textContent=e.message;}}),button('Удалить ключ',async()=>{await chrome.storage.session.remove('vjaWritingApiKey');await chrome.storage.local.remove('vjaWritingApiKey');key.value='';status.textContent='Ключ удалён.';}),status);aiHost.append(model);
})().catch(e=>{console.warn('Violetta memory settings:',e.message);});
