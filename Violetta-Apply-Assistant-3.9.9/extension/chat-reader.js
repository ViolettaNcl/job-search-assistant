/* Scoped DOM reader: never promotes unknown authors or sidebar previews to recruiter messages. */
(function(root){
 'use strict';
 const C=root.vjaCopilotCore;
 const ids=new WeakMap();let seq=0;
 const visible=el=>Boolean(el&&el.isConnected&&!el.closest('[data-vja-root],[hidden],[aria-hidden="true"]')&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
 const text=(el,n=14000)=>String(el?.innerText||el?.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim().slice(0,n);
 const WRAPPER='[data-message-id],[data-qa="chat-message"],[data-qa*="chatik-message"],[data-qa*="message-text"],[data-testid*="message-bubble"],[data-testid="message"],[data-direction="incoming"],[data-direction="outgoing"],[data-sender="candidate"],[data-sender="employer"],.incoming,.outgoing,[class*="message-bubble"],[class*="bubble"],[class*="message-wrapper"],[class*="message-content"],[class*="chat-message"]';
 const logNodes=scope=>[...scope.querySelectorAll(WRAPPER)].filter(visible).filter(e=>!e.matches('textarea,input,[contenteditable="true"]')&&!e.closest('nav,aside,[role="navigation"]'));
 function composer(doc,url){
  const chatUrl=/chat|message|conversation|negotiation|inbox/i.test(url);
  const active=doc.activeElement;
  const xs=[...doc.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].filter(visible).filter(e=>!e.disabled&&!e.readOnly);
  return xs.map(el=>{const meta=[el.getAttribute('placeholder'),el.getAttribute('aria-label'),el.getAttribute('data-qa'),el.getAttribute('name'),el.className].join(' ');let score=/message|reply|chat|сообщ|ответ|напис|переписк/i.test(meta)?8:0;if(chatUrl)score+=3;if(el===active)score+=2;if(/search|поиск|cover|сопровод|prompt|salary/i.test(meta))score-=20;return {el,score};}).sort((a,b)=>b.score-a.score).find(x=>x.score>=3)?.el||null;
 }
 function scopeFor(input){
  if(!input)return null;
  const explicit=input.closest('[data-conversation-id],[data-thread-id],[data-chat-id],[data-negotiation-id]');
  if(explicit&&explicit!==document.body)return explicit;
  let n=input.parentElement;
  for(let d=0;n&&n!==document.body&&d<15;d++,n=n.parentElement){
   if(n.matches('main,[role="main"]')||logNodes(n).length||n.querySelector('[role="log"],[class*="message-list"],[class*="messages-list"]'))return n;
  }
  // Limit fallback to a single panel with a composer, not the whole document.
  return input.closest('main,[role="main"],[class*="chat-panel"],[class*="conversation-panel"],[class*="chat-container"]');
 }
 function author(el,scope,input){
  let n=el,marker='',explicit='';
  for(let i=0;n&&n!==scope&&i<8;i++,n=n.parentElement){
   marker+=' '+['data-sender','data-author-role','data-direction','data-qa','data-testid','class','aria-label'].map(k=>n.getAttribute?.(k)||'').join(' ');
   if(n.getAttribute?.('data-is-own')==='true'||n.getAttribute?.('data-from-me')==='true')explicit='candidate';
   if(n.getAttribute?.('data-is-own')==='false'||n.getAttribute?.('data-from-me')==='false')explicit='employer';
  }
  if(explicit)return {speaker:explicit,senderConfidence:'explicit'};
  if(/outgoing|candidate|from-me|message[_-]me\b|message[_-]own|\bown\b|\bsent\b|\bself\b|мое сообщение|моё сообщение/i.test(marker))return {speaker:'candidate',senderConfidence:'marker'};
  if(/incoming|employer|recruiter|received|message[_-]other|собеседник|работодател/i.test(marker))return {speaker:'employer',senderConfidence:'marker'};
  if(C.provider(location.href)==='hh'&&input){const r=el.getBoundingClientRect(),i=input.getBoundingClientRect();if(r.width>20&&r.width<i.width*.72){const c=r.left+r.width/2,mid=i.left+i.width/2;if(Math.abs(c-mid)>i.width*.12)return {speaker:c>mid?'candidate':'employer',senderConfidence:'layout'};}}
  return {speaker:'unknown',senderConfidence:'unknown'};
 }
 function readMessages(scope,input,url){
  if(!scope)return [];
  let nodes=logNodes(scope).filter(e=>!e.contains(input)&&!input?.contains(e));
  // Keep a complete message wrapper, not each paragraph/link in that message.
  const stable=nodes.filter(e=>e.hasAttribute('data-message-id'));
  nodes=nodes.filter(e=>!nodes.some(other=>other!==e&&other.contains(e)&&(!e.hasAttribute('data-message-id')||other.hasAttribute('data-message-id'))));
  nodes=[...new Set([...nodes,...stable.filter(e=>!nodes.some(n=>n.contains(e)))])];
  let fallback=false;
  if(!nodes.length&&C.provider(url)==='hh'&&input){
   fallback=true;const ir=input.getBoundingClientRect();
   let cs=[...scope.querySelectorAll('p,div,li,section')].filter(visible).filter(e=>!e.contains(input)&&!e.closest('header,nav,aside,button,[role="navigation"]')&&text(e).length>=8&&text(e).length<14000);
   cs=cs.filter(e=>{const r=e.getBoundingClientRect();return r.bottom<=ir.top+3&&Math.min(r.right,ir.right)>Math.max(r.left,ir.left)+20;});
   nodes=cs.filter(e=>!cs.some(c=>c!==e&&e.contains(c)));
  }
  nodes.sort((a,b)=>a===b?0:(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1));
  const occurrences=new Map();
  return nodes.map((e,order)=>{
   const copy=e.cloneNode(true);copy.querySelectorAll('button,script,style,time,[class*="timestamp"],[data-qa*="message-time"],[aria-hidden="true"]').forEach(n=>n.remove());
   copy.querySelectorAll('br').forEach(n=>n.replaceWith(document.createTextNode('\n')));copy.querySelectorAll('p,li,div').forEach(n=>n.append(document.createTextNode('\n')));
   const value=String(copy.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim().slice(0,14000);
   const timestamp=e.getAttribute('data-timestamp')||e.querySelector('time')?.getAttribute('datetime')||'';
   const a=author(e,scope,input),base=C.hash([a.speaker,timestamp,value].join('|')),ordinal=occurrences.get(base)||0;occurrences.set(base,ordinal+1);
   return {id:e.getAttribute('data-message-id')||e.closest('[data-message-id]')?.getAttribute('data-message-id')||'text-'+base+'-'+ordinal,idConfidence:e.hasAttribute('data-message-id')?'explicit':'content',...a,text:value,timestamp,order,fallback};
  }).filter(m=>m.text.length>1).slice(-500);
 }
 function read(doc=document,url=location.href,input=null){
  input=input||composer(doc,url);const scope=scopeFor(input);
  if(!input||!scope)return {detected:false,input,scope,readDiagnostics:{reason:'composer-or-panel-missing',messages:0}};
  const messages=readMessages(scope,input,url);let u;try{u=new URL(url);}catch{return {detected:false};}
  let conversationId='';
  for(const key of ['data-conversation-id','data-thread-id','data-chat-id','data-negotiation-id'])conversationId ||=scope.getAttribute(key)||input.closest('['+key+']')?.getAttribute(key)||'';
  for(const key of ['conversationId','threadId','chatId','negotiationId','chat','thread','conversation'])conversationId ||=u.searchParams.get(key)||'';
  conversationId ||=u.pathname.match(/\/(?:chats?|messages|messaging\/thread|conversations?|negotiations)\/([^/?#]+)/i)?.[1]||'';
  conversationId ||=u.hash.match(/(?:chat|thread|conversation)[=/:\-]([^/&?]+)/i)?.[1]||'';
  const weak=!conversationId;
  if(weak){if(!ids.has(scope))ids.set(scope,++seq);const heading=text(scope.querySelector('h1,h2,header,[class*="recipient"]'),600);conversationId='dom:'+ids.get(scope)+':'+C.hash(heading);}
  const links=[...scope.querySelectorAll('a[href*="/vacancy/"],a[href*="/jobs/view/"],a[href*="jobId="]')].filter(visible).filter(e=>!e.closest('nav,aside'));
  const distinct=[...new Map(links.map(e=>[C.canonicalUrl(e.href),e])).values()],ref=distinct.length===1?distinct[0]:null;
  const vacancyId=scope.getAttribute('data-vacancy-id')||scope.getAttribute('data-job-id')||(ref?C.idFromUrl(ref.href):'');
  const latest=[...messages].reverse().find(m=>m.speaker==='employer'),last=messages.at(-1);
  return {detected:true,input,scope,provider:C.provider(url),url,conversationId,identityConfidence:weak?'weak':'direct',applicationId:scope.getAttribute('data-application-id')||scope.getAttribute('data-response-id')||'',vacancyId,vacancyUrl:ref?.href||'',vacancy:ref?C.vacancy({url:ref.href,title:text(ref,350),vacancyId}):null,messages,latestInbound:latest?.text||'',latestInboundId:latest?.id||'',unknownSender:!latest||last?.speaker==='unknown',hasComposer:true,historyPartial:true,readDiagnostics:{messages:messages.length,employer:messages.filter(m=>m.speaker==='employer').length,candidate:messages.filter(m=>m.speaker==='candidate').length,unknown:messages.filter(m=>m.speaker==='unknown').length,layoutAuthors:messages.filter(m=>m.senderConfidence==='layout').length,scopeTag:scope.tagName,identity:weak?'ephemeral':'direct',reason:messages.length?'read':'no-message-nodes'}};
 }
 root.vjaChatReader={composer,scopeFor,readMessages,read};
})(globalThis);
