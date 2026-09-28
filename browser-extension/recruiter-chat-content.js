/* Live DOM-first chat copilot. Replaces the previous pencil implementation. */
(function(root){
  'use strict';
  if(root.vjaLiveChat)return;
  const C=root.vjaCopilotCore,A=root.vjaSiteAdapters,U=root.vjaCopilotUI,Q=root.vjaQuickReplies;
  const documentId=root.vjaUniversal?.documentId||C.newId();
  let bar=null,panel=null,draft=null,replyIdentity=null,epoch=0,timer=null,active='',latestFingerprint='',loading=false;
  let renderSignature='';
  let profile=null,personal=[],recent=[],settings={},quick=[],lastResolved=null;
  const request=(op,args={})=>chrome.runtime.sendMessage({type:'vjaCopilot',op,...args});
  const adapter=()=>A.make(document,location.href);
  const authorOverrides=new Map();
  function snapshot(){const s=adapter().conversation();if(s.messages){s.messages=s.messages.map(m=>{const key=conversationIdentity(s)+'|'+m.id+'|'+C.hash(m.text);return authorOverrides.has(key)?{...m,speaker:authorOverrides.get(key),senderConfidence:'user-confirmed'}:m;});const last=[...s.messages].reverse().find(m=>m.speaker==='employer');s.latestInbound=last?.text||'';s.latestInboundId=last?.id||'';s.unknownSender=s.messages.at(-1)?.speaker==='unknown';}return {...s,documentId};}
  function conversationIdentity(s={}){const c=C.identity(s);return [c.provider,c.conversationId||'',c.applicationId||'',c.vacancyId||''].join('|');}
  function sameConversation(a,b){
    if(!a||!b||a.detected===false||b.detected===false)return false;
    const x=C.identity(a),y=C.identity(b);if(x.provider&&y.provider&&x.provider!==y.provider)return false;
    if(x.conversationId&&y.conversationId)return x.conversationId===y.conversationId;
    if(x.applicationId&&y.applicationId)return x.applicationId===y.applicationId;
    if(x.vacancyId&&y.vacancyId)return x.vacancyId===y.vacancyId&&a.documentId===b.documentId;
    return a.documentId===b.documentId;
  }
  function fingerprint(s){return conversationIdentity(s)+'|'+C.hash((s.messages||[]).slice(-1).map(m=>[m.id,m.speaker,m.text].join(':')).join('|'));}
  function identityMatches(s){const now=snapshot();return sameConversation(s,now);}
  function currentMatches(s){const now=snapshot();return sameConversation(s,now)&&fingerprint(s)===fingerprint(now);}
  function close(){panel?.close();panel=null;draft=null;replyIdentity=null;}
  function invalidate(){epoch++;close();lastResolved=null;void request('invalidate').catch(()=>{});}
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  function messageKey(m){return m.id?'id:'+m.id:[m.speaker,m.timestamp,m.text].join('|');}
  function mergeHistory(older,current){
    let overlap=0;for(let k=1;k<=Math.min(older.length,current.length);k++)if(older.slice(-k).every((m,i)=>messageKey(m)===messageKey(current[i])))overlap=k;
    if(overlap)return [...older.slice(0,-overlap),...current].slice(-500);
    const ids=new Set(current.map(m=>m.id).filter(Boolean));
    if(older.some(m=>m.id&&ids.has(m.id)))return [...older.filter(m=>!m.id||!ids.has(m.id)),...current].slice(-500);
    return [...older,...current].slice(-500);
  }
  async function loadHistory(s){
    const a=adapter(),scope=a.chatRoot();if(!scope)return s;
    const candidates=[scope,...A.all('*',scope)].filter(el=>el.scrollHeight>el.clientHeight+2&&/auto|scroll/.test(getComputedStyle(el).overflowY));
    const scroller=candidates.find(el=>a.getMessages(el).length)||null;
    if(!scroller)return {...s,historyPartial:!scope.querySelector('[data-history-start],[data-chat-start]')};
    const oldTop=scroller.scrollTop,oldHeight=scroller.scrollHeight,oldBottom=oldHeight-oldTop;let all=s.messages||[],unchanged=0,reachedBeginning=false;
    loading=true;
    try{
      const limit=Math.min(40,Math.max(1,Number(settings.historyLimit)||24));
      for(let i=0;i<limit;i++){
        if(!identityMatches(s))throw new Error('Чат изменился.');
        scroller.scrollTop=Math.max(0,scroller.scrollTop-Math.max(200,scroller.clientHeight*.85));
        scroller.dispatchEvent(new Event('scroll',{bubbles:true}));
        await delay(220);
        if(!identityMatches(s))throw new Error('Чат изменился.');
        const batch=snapshot().messages||[];
        if(batch.map(messageKey).join('\n')===all.slice(0,batch.length).map(messageKey).join('\n'))unchanged++;else{all=mergeHistory(batch,all);unchanged=0;}
        if(unchanged>=2&&scroller.scrollTop===0){reachedBeginning=true;break;}
      }
    }finally{
      if(identityMatches(s)&&scroller.isConnected)scroller.scrollTop=Math.max(0,scroller.scrollHeight-oldBottom);
      loading=false;
    }
    const latest=[...all].reverse().find(m=>m.speaker==='employer');
    return {...s,messages:all,latestInbound:latest?.text||'',latestInboundId:latest?.id||'',readDiagnostics:{...(s.readDiagnostics||{}),messages:all.length,employer:all.filter(m=>m.speaker==='employer').length,candidate:all.filter(m=>m.speaker==='candidate').length,unknown:all.filter(m=>m.speaker==='unknown').length},historyPartial:!scope.querySelector('[data-history-start],[data-chat-start]'),readStop:reachedBeginning?'stable-top-not-proven-complete':'safe-limit'};
  }
  function vars(s){return {firstName:profile?.firstName,email:profile?.contacts?.email,telegram:profile?.contacts?.telegram,jobTitle:s.vacancy?.title||lastResolved?.application?.vacancy?.title||'',company:s.company||lastResolved?.application?.vacancy?.company||'',recruiterName:s.recruiterName||''};}
  function currentDraftText(){const el=adapter().getReplyInput();return String(el?.isContentEditable?el.innerText:el?.value||'').trim().slice(0,6000);}
  function insertText(text,expected,{replace=false}={}){
    if(!expected||!currentMatches(expected))return {ok:false,error:'Переписка изменилась. Подготовьте ответ заново.',code:'stale'};
    const el=adapter().getReplyInput();if(!el)return {ok:false,error:'Поле ответа недоступно.'};
    const next=String(text||'').trim();if(!next)return {ok:false,error:'Черновик пустой.'};
    const before=String(el.isContentEditable?el.innerText:el.value||'').trim();
    if(before&&before!==next&&!replace)return {ok:false,error:'В поле уже есть ваш текст. Он сохранён. Заменить его можно отдельной кнопкой.',code:'existing'};
    if(el.maxLength>0&&next.length>el.maxLength)return {ok:false,error:'Ответ длиннее лимита поля.'};
    el.focus();
    if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,next);}
    else{el.textContent=next;}
    // Never synthesize Enter, click Send, submit a form, or invoke a platform API.
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:next}));el.dispatchEvent(new Event('change',{bubbles:true}));
    return {ok:true,inserted:true,sent:false};
  }
  async function quickInsert(item,s=snapshot()){
    if(!item)return;
    const result=insertText(item.text,s);
    if(result.ok){recent=[...recent,{id:item.id,at:Date.now()}].slice(-12);void request('remember-template',{snapshot:s,id:item.id}).catch(()=>{});close();renderBar();}
    else{
      close();const p=U.panel('Быстрый ответ',adapter().getReplyInput());panel=p;p.status(result.error);
      if(result.code==='existing')p.body.append(U.button('Заменить мой черновик',()=>{const r=insertText(item.text,s,{replace:true});if(r.ok){void request('remember-template',{snapshot:s,id:item.id});close();}else p.status(r.error);}));
    }
  }
  function showLibrary(){
    const s=snapshot();if(!s.detected)return;close();const lang=C.language(s.latestInbound||s.messages?.at(-1)?.text||'');
    const p=U.panel('Быстрые ответы',adapter().getReplyInput());panel=p;
    for(const item of Q.library(lang,vars(s),personal))p.body.append(U.button(item.label,()=>void quickInsert(item,s),'choice'));
    p.body.append(U.button('Настроить ответы и клавиши',()=>void request('open-options'),'choice'));p.place();
  }
  function openAiMenu(){
    const s=snapshot();if(!s.detected)return;
    close();const p=U.panel('✎ AI · текущий диалог',adapter().getReplyInput());panel=p;
    const status=p.status('AI работает только с открытым сейчас чатом. Выберите действие.');
    const actions=document.createElement('div');actions.className='actions';
    const userAction=(style,seed='')=>event=>{if(event?.isTrusted===false)return;void analyze(style,typeof seed==='function'?seed():seed,true);};
    actions.append(U.button('🧠 Проанализировать весь диалог и ответить',userAction('dialog'),'primary'));
    actions.append(U.button('Ответить на последнее сообщение',userAction('neutral')));
    if(currentDraftText())actions.append(U.button('Улучшить мой текст',userAction('polish',()=>currentDraftText())));
    actions.append(U.button('Вопрос работодателю',userAction('question')));
    actions.append(U.button('Быстрые ответы',showLibrary));
    p.body.append(actions);p.place();return status;
  }
  function renderBar(){
    const s=snapshot();if(!s.detected){bar?.remove();bar=null;renderSignature='';return;}
    const lang='ru';
    quick=profile?Q.suggest(s.latestInbound,lang,vars(s),recent,personal,(s.messages||[]).filter(m=>m.speaker==='candidate')):[];
    const signature=fingerprint(s)+'|'+quick.map(x=>x.id+':'+x.text).join('|')+'|'+Boolean(profile);
    if(signature===renderSignature&&bar?.host?.isConnected){bar.place();return;}
    renderSignature=signature;bar?.remove();
    const items=[...quick.map(item=>({label:item.label,onClick:()=>void quickInsert(item,s)}))];
    if(currentDraftText())items.push({label:'Улучшить текст',onClick:()=>void analyze('polish',currentDraftText(),true)});
    items.push({label:'✎ AI',primary:true,onClick:openAiMenu},{label:'⋯',onClick:showLibrary});
    bar=U.bar(items,adapter().getReplyInput());
  }
  async function analyze(style='neutral',seedDraft='',explicitUserRequest=false){
    const s=snapshot();if(!s.detected)return {ok:false};
    close();const localEpoch=++epoch,p=U.panel('✎ AI · ответ работодателю',adapter().getReplyInput());panel=p;
    const status=p.status('Читаю переписку…');
    try{
      if(!profile){const data=await request('bootstrap');profile=data.profile;personal=data.personalReplies||[];settings=data.settings||{};}
      const full=await loadHistory(s);full.candidateDraft=String(seedDraft||currentDraftText()).trim().slice(0,6000);
      if(localEpoch!==epoch||!currentMatches(s))return {ok:false,code:'stale'};
      const resolved=await request('resolve',{snapshot:full});
      if(localEpoch!==epoch||!currentMatches(s))return {ok:false,code:'stale'};
      if(resolved.ok===false)throw new Error(resolved.error);
      lastResolved=resolved;
      const summary=document.createElement('div');summary.className='summary';summary.textContent=`${resolved.application.vacancy.title}${resolved.application.vacancy.company?' — '+resolved.application.vacancy.company:''}\n${full.messages.length} сообщений прочитано${full.historyPartial?' · история может быть неполной':''}${resolved.cvUnknown?'\nРезюме исходного отклика неизвестно; используется текущий профиль.':''}`;p.body.prepend(summary);
      if(!resolved.settings?.aiConsent&&!explicitUserRequest){status.textContent='AI выключен в настройках. Нажмите основную кнопку анализа в этом чате, чтобы разрешить разовую обработку текущего диалога.';p.place();return {ok:false,code:'consent-required'};}
      if(!full.latestInbound||full.messages?.at(-1)?.speaker==='unknown'){
        const unknown=full.messages?.at(-1);status.textContent=full.messages?.length?'Текст прочитан, но сайт не обозначил автора последнего сообщения. Проверьте его перед анализом.':'Сообщения не найдены в активном диалоге.';
        if(unknown){const preview=document.createElement('p');preview.textContent=unknown.text;p.body.append(preview,U.button('Это сообщение работодателя — анализировать',event=>{if(event?.isTrusted===false)return;authorOverrides.set(conversationIdentity(s)+'|'+unknown.id+'|'+C.hash(unknown.text),'employer');void analyze(style,seedDraft,true);}));}
        p.place();return {ok:false,code:'unknown-sender'};
      }
      full.requestId=C.newId();status.textContent='Готовлю ответ…';
      const result=await request('analyze',{snapshot:full,style,explicitUserRequest:Boolean(explicitUserRequest)});
      if(localEpoch!==epoch||!currentMatches(s)||result.context&&!sameConversation(result.context,s)||result.requestId&&result.requestId!==full.requestId)return {ok:false,code:'stale'};
      if(!result.ok){if(result.latestRead){const last=document.createElement('p');last.textContent='Последнее прочитанное сообщение: '+result.latestRead;p.body.append(last);}if(result.missingFacts?.length){const missing=document.createElement('p');missing.textContent='Нужно уточнить: '+result.missingFacts.map(x=>x.question||x.reason).join(' · ');p.body.append(missing);}throw new Error(result.error||'AI недоступен.');}
      const readBack=document.createElement('details'),readLabel=document.createElement('summary');readLabel.textContent='Что прочитано и на чём основан ответ';readBack.append(readLabel);const info=document.createElement('p');info.textContent=`${result.messageCount||full.messages.length} сообщений · ${result.source==='configured-ai'?'AI-модель':'локальный ответ по подтверждённым фактам'}. Последнее сообщение: ${result.latestRead||full.latestInbound}`;readBack.append(info);if(result.providerWarning){const warning=document.createElement('p');warning.textContent='AI не использован: '+result.providerWarning;readBack.append(warning);}p.body.append(readBack);if(result.missingFacts?.length){const missing=document.createElement('p');missing.textContent='Перед отправкой дополните: '+result.missingFacts.map(x=>x.reason||x.question).join(' · ');p.body.append(missing);}
      draft=document.createElement('textarea');draft.className='draft';draft.setAttribute('aria-label','Черновик ответа');draft.value=result.triage.suggestedReply;replyIdentity=s;p.body.append(draft);
      const actions=document.createElement('div');actions.className='actions';
      actions.append(U.button('🧠 Ещё раз проанализировать весь диалог',event=>{if(event?.isTrusted===false)return;void analyze('dialog','',true);}));
      actions.append(U.button(full.candidateDraft?'Улучшить мой текст':'Улучшить этот черновик',event=>{if(event?.isTrusted===false)return;void analyze('polish',draft?.value||full.candidateDraft,true);}));
      for(const [label,value] of [['Ответить на все вопросы','complete'],['Вопрос работодателю','question'],['Короче','short'],['Дружелюбнее','warm'],['Увереннее','confident']])actions.append(U.button(label,event=>{if(event?.isTrusted===false)return;void analyze(value,'',true);}));
      actions.append(U.button('Вставить',()=>{
        const r=insertText(draft?.value,replyIdentity);status.textContent=r.ok?'✓ Текст вставлен, но не отправлен. Проверьте его и нажмите Send на сайте.':r.error;if(r.ok)void request('remember-ai-draft',{snapshot:replyIdentity,style}).catch(()=>{});
        if(r.code==='existing')actions.append(U.button('Заменить мой черновик',()=>{const x=insertText(draft?.value,replyIdentity,{replace:true});status.textContent=x.ok?'Текст вставлен. Отправьте его самостоятельно.':x.error;}));
      },'primary'));
      p.body.append(actions);status.textContent='✓ Ответ готов к проверке. Отправка — только вручную.';p.body.append(status);p.place();return {ok:true};
    }catch(e){if(localEpoch===epoch&&currentMatches(s)){status.textContent=e.message||'Не удалось подготовить ответ.';p.body.append(U.button('Быстрые ответы без AI',showLibrary,'choice'));p.place();}return {ok:false,error:e.message};}
  }
  async function scan(){
    const s=snapshot();if(!s.detected){if(active){invalidate();active='';latestFingerprint='';}bar?.remove();bar=null;return;}
    const id=conversationIdentity(s),fp=fingerprint(s);
    const changed=id!==active,messageChanged=Boolean(latestFingerprint&&latestFingerprint!==fp&&!loading);
    if(!loading&&(changed||messageChanged))invalidate();
    active=id;latestFingerprint=fp;
    // The pencil is a context-local UI affordance and must not depend on a
    // saved application or a successful profile/bootstrap request.
    renderBar();
    if(changed||!profile){
      try{const data=await request('quick-context',{snapshot:s});if(!currentMatches(s))return;profile=data.profile;personal=data.personalReplies||[];settings=data.settings||{};recent=data.recent||[];}catch{return;}
    }else if(messageChanged){void request('observe-chat',{snapshot:s}).catch(()=>{});}
    renderBar();
  }
  const observer=new MutationObserver(mutations=>{
    if(mutations.every(m=>m.target instanceof Element&&m.target.closest('[data-vja-root]')))return;
    clearTimeout(timer);timer=setTimeout(()=>void scan(),180);
  });observer.observe(document.documentElement,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-conversation-id','data-thread-id','data-chat-id','aria-selected']});
  addEventListener('popstate',()=>{invalidate();void scan();});addEventListener('hashchange',()=>{invalidate();void scan();});
  addEventListener('scroll',()=>{bar?.place();panel?.place();},{passive:true,capture:true});addEventListener('resize',()=>{bar?.place();panel?.place();});
  chrome.runtime.onMessage.addListener((m,_sender,respond)=>{
    if(m?.type==='vjaRecruiterChatSnapshot'){respond(snapshot());return false;}
    if(m?.type==='vjaRecruiterChatInsert'){respond(insertText(m.text,m.context));return false;}
    if(m?.type!=='vjaCopilotPage'||!['command','ai','snapshot'].includes(m.action))return false;
    if(m.action==='snapshot'){respond(snapshot());return false;}
    const s=snapshot();if(!s.detected){respond({ok:false,error:'Откройте переписку с работодателем.'});return false;}
    if(m.action==='ai'||m.command==='open-ai'){openAiMenu();respond({ok:true});return false;}
    const lang='ru',lib=Q.library(lang,vars(s),personal);
    const hotkeyReplyId=m.command==='contacts-reply'?'contacts':m.command==='thank-you-reply'?'feedback_default':'';
    const item=m.command==='suggested-reply'?quick[0]:lib.find(x=>x.id===hotkeyReplyId);
    if(item)void quickInsert(item,s);respond({ok:Boolean(item),sent:false});return false;
  });
  root.vjaLiveChat={snapshot,analyze,openAiMenu,insertText,mergeHistory,loadHistory,scan};
  void scan();
})(globalThis);
