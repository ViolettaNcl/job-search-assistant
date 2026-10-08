/* Small per-provider selector profiles over a shared, conservative DOM adapter. */
(function(root){
  'use strict';
  const C=root.vjaCopilotCore;
  const profiles={
    hh:{title:['[data-qa="vacancy-title"]'],company:['[data-qa="vacancy-company-name"]'],description:['[data-qa="vacancy-description"]'],messages:['[data-qa="chat-message"]','[data-qa*="chatik-message"]','[data-qa*="message-text"]','[data-qa*="chat-message"]','[data-qa*="message-container"]','[data-testid*="message"]','[class*="chat-message"]','[class*="message-bubble"]'],jobLink:'a[href*="/vacancy/"]'},
    linkedin:{title:['.job-details-jobs-unified-top-card__job-title','h1'],company:['.job-details-jobs-unified-top-card__company-name'],description:['#job-details'],messages:['.msg-s-event-listitem','.msg-s-message-list__event'],jobLink:'a[href*="/jobs/view/"]'},
    indeed:{title:['[data-testid="jobsearch-JobInfoHeader-title"]','.jobsearch-JobInfoHeader-title'],company:['[data-testid="inlineHeader-companyName"]'],description:['#jobDescriptionText']},
    greenhouse:{title:['.app-title','.job__title','h1'],company:['.company-name'],description:['#content','.job__description']},
    lever:{title:['.posting-headline h2','.posting-headline h1'],company:['.main-header-logo img[alt]'],description:['.posting-page .content','.posting-page .section-wrapper']},
    workday:{title:['[data-automation-id="jobPostingHeader"]'],description:['[data-automation-id="jobPostingDescription"]']},
    smartrecruiters:{title:['.job-title','h1'],company:['.company-name'],description:['[itemprop="description"]','#st-jobDescription']},
    teamtailor:{title:['h1'],description:['[data-controller="careersite--job-description"]','.body-block']},
    ashby:{title:['[class*="jobPostingHeader"] h1','h1'],description:['[class*="jobDescription"]','[data-testid="job-description"]']},
    workable:{title:['[data-ui="job-title"]'],description:['[data-ui="job-description"]']},
    habr:{title:['.vacancy-title__text','h1'],company:['.company_name','[class*=company] a'],description:['.vacancy-description','[class*=vacancy-description]','main'],jobLink:'a[href*="/vacancies/"]'},
    avito:{
      title:['[data-marker="item-view/title-info"] h1','[data-marker="item-view/title-info"]','[data-marker="item-title"]','h1'],
      company:['[data-marker="seller-info/name"]','[data-marker*="seller-info"] [itemprop="name"]','[data-marker*="seller"] h2','[data-marker*="seller"] h3'],
      description:['[data-marker="item-view/item-description"]','[data-marker="item-description/text"]','[data-marker*="item-description"]','[itemprop="description"]'],
      messages:['[data-marker*="message"]','[data-testid*="message"]','[class*="message-bubble"]','[class*="messenger-message"]'],
      jobLink:'a[href*="/vakansii/"]'
    },
    superjob:{title:['h1'],description:['[itemprop="description"]']},
    geekjob:{title:['h1'],description:['.job-description']},
    bamboohr:{title:['[class*="JobOpening"] h1','h1'],description:['[class*="jobDescription"]']},
    recruitee:{title:['[data-cy="job-title"]','h1'],description:['[data-cy="job-description"]']},
    personio:{title:['.job-title','h1'],description:['.job-description']},
    comeet:{title:['h1'],description:['[class*="position-description"]']},
    jobvite:{title:['.jv-header h2','h1'],description:['.jv-job-detail-description']},glassdoor:{title:['h1'],description:['.JobDetails_jobDescription__uW_fK']},generic:{}
  };
  const generic={title:['[itemprop="title"]','[data-testid*="job-title"]','[class*="job-title"]','h1'],company:['[itemprop="hiringOrganization"] [itemprop="name"]','[data-testid*="company-name"]','[class*="company-name"]'],description:['[itemprop="description"]','[data-testid*="job-description"]','[class*="job-description"]','[class*="vacancy-description"]']};
  const messageSelectors=['[data-message-id]','[data-testid="message"]','[data-qa="message"]','[data-sender]','[class*="message-bubble"]','[class*="messageBubble"]','[class~="message"]','[role="log"] [role="article"]'];
  const ui = el => Boolean(el?.closest?.('[data-vja-root], [data-vja-recruiter-copilot]'));
  function all(selector,scope=document,depth=0){
    let found=[];try{found=[...scope.querySelectorAll(selector)].filter(el=>!ui(el));}catch{return [];}
    if(depth<4){for(const el of scope.querySelectorAll('*'))if(el.shadowRoot&&!ui(el))found.push(...all(selector,el.shadowRoot,depth+1));}
    return [...new Set(found)];
  }
  function visible(el){if(!el||ui(el)||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&el.getClientRects().length>0;}
  function text(el,max=24000){return C.clip(el?.innerText||el?.textContent||el?.getAttribute?.('alt')||'',max);}
  function first(selectors,scope=document){for(const s of selectors){const e=all(s,scope).find(visible);if(e)return text(e,60000)||e.getAttribute('alt')||'';}return '';}
  function attr(scope,names){if(!scope)return '';for(const key of names){let el=scope instanceof Element&&scope.hasAttribute(key)?scope:all(`[${key}]`,scope).find(visible);const value=el?.getAttribute(key);if(value)return C.clip(value,300);}return '';}
  function formFields(scope=document){const fields=all('input,textarea,select,[contenteditable="true"][role="textbox"],[role="combobox"],[role="radiogroup"],[role="checkbox"]',scope).filter(el=>!el.disabled&&!el.readOnly&&el.getAttribute('aria-disabled')!=='true'&&(!['hidden','password','submit','button','reset','image'].includes(el.type))&&(visible(el)||el.type==='file'&&visible(el.parentElement)));return root.vjaChoiceControls?.groupFields(fields)||fields;}

  function label(el){
    const parts=[el.getAttribute('aria-label'),el.getAttribute('placeholder'),el.getAttribute('name'),el.id];
    const scope=el.getRootNode();
    if(el.id)try{parts.unshift(text(scope.querySelector(`label[for="${CSS.escape(el.id)}"]`),400));}catch{}
    if(el.closest('label'))parts.unshift(text(el.closest('label'),400));
    for(const id of (el.getAttribute('aria-labelledby')||'').split(/\s+/))if(id)parts.unshift(text(scope.getElementById?.(id),400));
    const group=el.closest('fieldset,[role="group"],.field,.question,[data-automation-id="formField"]');
    if(group)parts.unshift(first(['legend','label','[class*="label"]'],group));
    return [...new Set(parts.filter(Boolean))].join(' ').slice(0,1000);
  }
  function descriptor(el,i=0){const d={token:typeof ensureToken==='function'?ensureToken(el,i):'field-'+i,label:label(el),type:el.getAttribute('role')==='combobox'?'combobox':el.tagName==='SELECT'?(el.multiple?'multiselect':'select'):el.tagName==='TEXTAREA'||el.isContentEditable?'textarea':el.type||el.getAttribute('role')||'text',currentValue:el.type==='file'?(el.files?.length?'attached':''):['radio','checkbox'].includes(el.type)?(el.checked?'checked':''):el.value||'',required:el.required||el.getAttribute('aria-required')==='true',maxLength:el.maxLength||0,options:el.options?[...el.options].map(o=>({value:o.value,text:text(o)})):[]};return root.vjaChoiceControls?.describe(el,d)||d;}
  function structured(doc=document){
    const items=[];
    for(const s of all('script[type="application/ld+json"]',doc))try{root.vjaAtsStructured?.collectJobPostings(JSON.parse(s.textContent),items);}catch{}
    if(items.length===1)return items[0];
    const id=C.idFromUrl(location.href);
    return items.find(j=>id&&(C.idFromUrl(j.url||'')===id||String(j.identifier?.value||'')===id))||null;
  }
  function make(doc=document,url=location.href){
    const provider=C.provider(url), cfg=profiles[provider]||profiles.generic;
    function extractVacancy(scope=doc){
      const j=scope===doc?structured(doc):null;
      let title=j?.title||first(cfg.title||[],scope)||first(generic.title,scope);
      // Search pages can contain an H1 such as “Найдено 19 718 вакансий”.
      // That is never a vacancy title. On direct HH vacancy pages prefer a
      // non-search H1 or document.title only after validating the vacancy URL.
      if(provider==='hh'&&C.suspiciousVacancyTitle?.(title)){
        const direct=/\/vacancy\/\d+/i.test(new URL(url).pathname);
        if(direct){
          title=all('h1',scope).filter(visible).map(el=>text(el,500)).find(x=>!C.suspiciousVacancyTitle?.(x))||'';
          if(!title&&scope===doc){
            const dt=String(doc.title||'').replace(/\s*[|—-]\s*(?:hh\.ru|HeadHunter).*$/i,'').replace(/^Вакансия\s+/i,'').trim();
            if(!C.suspiciousVacancyTitle?.(dt))title=dt;
          }
        }else title='';
      }
      let company=(typeof j?.hiringOrganization==='string'?j.hiringOrganization:j?.hiringOrganization?.name)||first([...(cfg.company||[]),...generic.company],scope);
      let description=j?.description?root.vjaAtsStructured.htmlToText(j.description):first([...(cfg.description||[]),...generic.description],scope);
      let locationText=j?.jobLocation?.address?.addressLocality||first(['[data-qa="vacancy-view-location"]','[data-marker="item-view/location"]','[data-marker="item-address"]','[class*="location"]'],scope);
      let requirements=j?.qualifications||j?.skills||'';
      let experience=j?.experienceRequirements||'';
      let employmentType=j?.employmentType||'';
      if(provider==='avito'){
        const sections=[
          first(['[data-marker="item-view/item-description"]','[data-marker="item-description/text"]','[data-marker*="item-description"]','[itemprop="description"]'],scope),
          first(['[data-marker="item-view/item-params"]','[data-marker*="item-params"]','[data-marker*="params"]'],scope),
          first(['[data-marker="item-view/seo-description"]'],scope)
        ].filter(Boolean);
        description=C.clip([...new Set(sections)].join('\n'),60000)||description;
        const body=C.clip([title,description,first(['main'],scope)].filter(Boolean).join('\n'),60000);
        requirements=C.clip([requirements,body.match(/(?:Требования|Что нужно|Мы ожидаем|Подойд[её]т, если)[:\s][\s\S]{0,3500}/i)?.[0]||''].filter(Boolean).join('\n'),5000);
        experience=experience||body.match(/(?:Опыт работы|Опыт)[:\s]{0,5}([^\n]{1,120})/i)?.[1]||'';
        employmentType=employmentType||body.match(/(?:График|Занятость|Формат работы)[:\s]{0,5}([^\n]{1,180})/i)?.[1]||'';
        if(!company)company=first(['[data-marker*="seller"] [data-marker*="name"]','[data-marker*="company"]'],scope);
      }
      const combinedText=[title,description,requirements,employmentType].filter(Boolean).join('\n');
      const v={provider,url,title,company,description,vacancyId:String(j?.identifier?.value||attr(scope,['data-vacancy-id','data-job-id','data-requisition-id','data-item-id'])||C.idFromUrl(url)),location:locationText,experience,employmentType,salary:j?.baseSalary||null,remote:/TELECOMMUTE/i.test(j?.jobLocationType||'')||/удал[её]н|дистанцион|remote|из дома/i.test(combinedText),requirements,descriptionCoverage:scope===doc?(j?'full-structured':'full-dom'):'partial'};
      return C.vacancy(v);
    }
    function getReplyInput(){
      if(root.vjaChatReader)return root.vjaChatReader.composer(doc,url);
      const pageHint=text(doc.body,1200);const urlHint=/chat|message|inbox|conversation|negotiation|dialog|responses?|отклики|переписк/i.test(url)||/переписк|сообщени.{0,20}работодател|recruiter|employer messages?/i.test(pageHint);
      const inputs=all('textarea,[contenteditable="true"],[role="textbox"],[data-qa*="chat" i][contenteditable="true"],[data-qa*="message" i] textarea',doc).filter(visible).filter(el=>!el.disabled&&!el.readOnly).map(el=>{
        const meta=label(el)+' '+String(el.className||'')+' '+String(el.getAttribute?.('data-qa')||'');let score=/(message|reply|сообщ|ответ|напис|chat|переписк)/i.test(meta)?6:0;
        if(/search|поиск|cover.?letter|сопровод|комментарий к отклику/i.test(meta))score-=12;
        if(urlHint)score+=3;
        if(el.closest('[data-conversation-id],[data-thread-id],[data-chat-id],[role="log"],[class*="chat"],[class*="conversation"],[class*="negotiation"]'))score+=3;
        return {el,score};
      }).sort((a,b)=>b.score-a.score);
      const threshold=urlHint?2:4;
      return inputs.find(x=>x.score>=threshold)?.el||null;
    }
    function chatRoot(input=getReplyInput()){
      if(root.vjaChatReader)return root.vjaChatReader.scopeFor(input);
      if(!input)return null;
      let node=input.parentElement;
      for(let depth=0;node&&depth<10;depth++,node=node.parentElement){
        if(all([...cfg.messages||[],...messageSelectors].join(','),node).filter(visible).length)return node;
        if(node.matches('main,[data-conversation-id],[data-thread-id],[data-chat-id]'))return node;
      }
      const roots=all('[role="log"],[data-conversation-id],[data-thread-id]',doc).filter(visible);
      return roots.length===1?roots[0]:input.closest('main')||doc.querySelector('main')||doc.body||null;
    }
    function fallbackMessageBlocks(scope,input=getReplyInput()){
      if(!scope||!input)return [];
      const ir=input.getBoundingClientRect(),sr=scope.getBoundingClientRect();
      const candidates=all('div,p,span,li,section,article',scope).filter(visible).map(el=>{
        const value=text(el,5000),r=el.getBoundingClientRect();
        let marker='',n=el;
        for(let depth=0;n&&n!==scope&&depth<5;depth++,n=n.parentElement)marker+=' '+['data-sender','data-direction','data-author-role','data-qa','data-testid','class'].map(k=>n.getAttribute?.(k)||'').join(' ');
        return {el,value,r,marker};
      }).filter(x=>{
        if(x.value.length<2||x.value.length>5000||x.el===input||x.el.contains(input)||input.contains(x.el))return false;
        if(x.el.closest('[data-vja-root],nav,aside,[role="navigation"]'))return false;
        if(/^(?:Чаты|Только непрочитанные|Вакансия|Перейти|Сообщение)$/i.test(x.value))return false;
        const overlap=Math.min(x.r.right,ir.right)-Math.max(x.r.left,ir.left);
        if(overlap<Math.min(Math.max(40,x.r.width*.2),120))return false;
        if(x.r.bottom>ir.top+4||x.r.top<sr.top-4)return false;
        return true;
      });
      // Prefer the deepest visible text blocks. Then merge adjacent fragments from
      // the same bubble (HH currently splits long recruiter messages into several
      // paragraph/link nodes without stable data-qa message wrappers).
      let leaves=candidates.filter(x=>!candidates.some(y=>y!==x&&x.el.contains(y.el)&&y.value.length>1&&y.r.width>20&&y.r.height>8));
      if(!leaves.length)leaves=candidates;
      leaves.sort((a,b)=>a.r.top-b.r.top||a.r.left-b.r.left);
      const groups=[];
      for(const item of leaves){
        const last=groups.at(-1);
        const markerSpeaker=/outgoing|candidate|from-me|message_me|\bown\b|\bsent\b|\bself\b/i.test(item.marker)?'candidate':/incoming|employer|recruiter|received/i.test(item.marker)?'employer':'unknown';
        const center=item.r.left+item.r.width/2,composerCenter=ir.left+ir.width/2;
        const geometricSpeaker=markerSpeaker==='unknown'&&item.r.width<ir.width*.82?(center>composerCenter+ir.width*.08?'candidate':'employer'):markerSpeaker;
        const speaker=geometricSpeaker;
        const gap=last?item.r.top-last.bottom:999, sameLane=last?Math.abs(item.r.left-last.left)<150:false;
        const common=last?.elements?.some(el=>{let n=item.el;for(let i=0;n&&i<4;i++,n=n.parentElement)if(n===el.parentElement)return true;return false;});
        if(last&&gap<=18&&(sameLane||common)&&(!last.speaker||last.speaker==='unknown'||speaker==='unknown'||last.speaker===speaker)){
          if(!last.parts.includes(item.value))last.parts.push(item.value);
          last.bottom=Math.max(last.bottom,item.r.bottom);last.left=Math.min(last.left,item.r.left);last.elements.push(item.el);
          if(last.speaker==='unknown'&&speaker!=='unknown')last.speaker=speaker;
        }else groups.push({parts:[item.value],top:item.r.top,bottom:item.r.bottom,left:item.r.left,speaker,elements:[item.el]});
      }
      return groups.map((g,i)=>({id:'dom-fallback-'+i,speaker:g.speaker||'unknown',text:C.clip(g.parts.join('\n').replace(/\n{3,}/g,'\n\n'),4500),timestamp:'',order:i})).filter(m=>m.text.length>1).slice(-120);
    }
    function getMessages(scope=chatRoot()){
      if(root.vjaChatReader)return root.vjaChatReader.readMessages(scope,getReplyInput(),url);
      if(!scope)return [];
      const input=getReplyInput();
      let nodes=all([...(cfg.messages||[]),...messageSelectors].join(','),scope).filter(visible).filter(el=>text(el,2600).length>1&&!el.contains(input));
      nodes=nodes.filter(el=>!nodes.some(other=>other!==el&&el.contains(other)));
      let messages=nodes.slice(-300).map((el,i)=>{
        let marker='';let n=el;
        for(let depth=0;n&&n!==scope&&depth<4;depth++,n=n.parentElement)marker+=' '+['data-sender','data-direction','data-author-role','data-qa','data-testid','class'].map(k=>n.getAttribute(k)||'').join(' ');
        const speaker=/outgoing|candidate|from-me|message_me|\bown\b|\bsent\b|\bself\b/i.test(marker)?'candidate':/incoming|employer|recruiter|received/i.test(marker)?'employer':'unknown';
        return {id:el.getAttribute('data-message-id')||el.closest('[data-message-id]')?.getAttribute('data-message-id')||'',speaker,text:text(el,2500),timestamp:el.getAttribute('data-timestamp')||el.querySelector('time')?.getAttribute('datetime')||'',order:i};
      });
      if(provider==='hh'&&messages.length<1)messages=fallbackMessageBlocks(scope,input);
      return messages;
    }
    function conversation(){
      if(root.vjaChatReader){const {input,scope,...snapshot}=root.vjaChatReader.read(doc,url);return snapshot;}
      const input=getReplyInput(), scope=chatRoot(input), messages=getMessages(scope);
      const strongChatHint=/chat|message|conversation|negotiation|responses?|отклики|переписк/i.test(url)||/переписк|сообщени.{0,20}работодател|recruiter|employer messages?/i.test(text(doc.body,1200));
      if(!input||!scope||(!messages.length&&!strongChatHint))return {detected:false};
      let u;try{u=new URL(url);}catch{return {detected:false};}
      let conversationId=attr(scope,['data-conversation-id','data-thread-id','data-chat-id','data-negotiation-id']);
      // Include attributes on a containing conversation panel, not sibling chats.
      if(!conversationId){const parent=input.closest('[data-conversation-id],[data-thread-id],[data-chat-id]');if(parent)conversationId=attr(parent,['data-conversation-id','data-thread-id','data-chat-id']);}
      for(const k of ['conversationId','threadId','chatId','negotiationId','chat','thread','conversation'])conversationId ||=u.searchParams.get(k)||'';
      conversationId ||=u.pathname.match(/\/(?:chat|chats|messages|messaging\/thread|conversation|conversations|negotiations)\/([^/?#]+)/i)?.[1]||'';
      if(!conversationId){const h=u.hash.match(/(?:chat|thread|conversation)[=/:-]([^/&?]+)/i);conversationId=h?.[1]||'';}
      let weak=false;
      if(!conversationId){weak=true;conversationId='page:'+C.hash(C.canonicalUrl(url)+'|'+first(['h1','h2','[class*="recipient"]'],scope));}
      const links=all(cfg.jobLink||'a[href*="/vacancy/"],a[href*="/jobs/view/"],a[href*="jobId="],a[href*="/jobs/"],a[href*="gh_jid="]',scope).filter(visible).map(a=>({url:a.href,title:text(a,300)}));
      const distinct=[...new Map(links.map(v=>[C.canonicalUrl(v.url),v])).values()];
      const ref=distinct.length===1?distinct[0]:null;
      const vacancyId=attr(scope,['data-vacancy-id','data-job-id','data-requisition-id'])||(ref?C.idFromUrl(ref.url):'');
      const company=first(['[data-company-name]','[class*="company-name"]'],scope);
      const recruiterName=first(['[data-recruiter-name]','[class*="recruiter-name"]','[class*="recipient-name"]'],scope);
      const employerMessage=[...messages].reverse().find(m=>m.speaker==='employer');
      const fallbackInbound=[...messages].reverse().find(m=>m.speaker!=='candidate');
      const latestInbound=(employerMessage||fallbackInbound)?.text||'';
      return {detected:true,provider,url,conversationId,identityConfidence:weak?'weak':'direct',applicationId:attr(scope,['data-application-id','data-response-id']),vacancyId,vacancyUrl:ref?.url||'',vacancy:ref?C.vacancy({...ref,provider,vacancyId,company}):null,messages,latestInbound,recruiterName,company,hasComposer:true,historyPartial:true,unknownSender:!employerMessage};
    }
    function detectApplicationForm(){
      const candidates=all('form,[role="dialog"],[data-application-form]',doc).filter(visible).filter(el=>{
        const fields=formFields(el);if(fields.length<1)return false;
        // IMPORTANT: classify the form by its own semantics, never by the page URL.
        // HH vacancy pages contain search/filter forms; the old URL-based check made
        // every form on /vacancy/<id> look like an application form and hid ✦ Apply.
        const own=(text(el,2200)+' '+(el.id||'')+' '+(el.getAttribute('action')||'')+' '+(el.getAttribute('aria-label')||'')).trim();
        const semantic=/apply|application|resume|résumé|cv|candidate|cover.?letter|отклик|резюме|сопровод|анкет|кандидат/i.test(own);
        const strong=Boolean(el.querySelector('input[type="file"],textarea[name*="cover" i],[data-qa*="vacancy-response" i],[data-qa*="resume" i]'))||Boolean(el.querySelector('[name="email"]')&&el.querySelector('input[type="file"]'));
        const hhDialog=provider==='hh'&&el.matches('[role="dialog"]')&&/отклик|резюме|сопровод|ваканси/i.test(own);
        return semantic||strong||hhDialog;
      });
      const nested=candidates.filter(el=>!candidates.some(other=>other!==el&&el.contains(other)))[0]||null;if(nested)return nested;
      // HH sometimes renders a dedicated questionnaire page without a semantic <form>.
      // Detect it from the page heading/route plus multiple visible editable fields,
      // then return the smallest stable container that owns those fields.
      if(provider==='hh'){
        const pageText=text(doc.body,5000),route=String(new URL(url).pathname+new URL(url).search);
        const fields=formFields(doc.body);
        const questionnaireHint=/отклик\s+на\s+ваканси|ответьте\s+на\s+вопрос|application\s+question|screening\s+question/i.test(pageText)||/(?:vacancy_response|application|questionnaire|screening)/i.test(route);
        const textFields=fields.filter(x=>x.tagName==='TEXTAREA'||x.isContentEditable||(x.tagName==='INPUT'&&['text','email','tel','number','search','url'].includes(x.type||'text')));
        const submit=all('button,input[type=submit]',doc).filter(visible).find(el=>/откликнуться|отправить|продолжить|apply|submit/i.test(text(el,180)||el.value||''));
        if(questionnaireHint&&textFields.length>=2&&submit){
          let scope=null,node=textFields[0]?.parentElement;
          while(node){if(textFields.every(f=>node.contains(f))&&node.contains(submit)){scope=node;break;}if(node===doc.body)break;node=node.parentElement;}
          return scope||doc.querySelector('main')||doc.body;
        }
      }
      return null;
    }
    function detectPageType(){
      const parsed=new URL(url),path=parsed.pathname;
      if(conversation().detected)return 'RECRUITER_CHAT';
      // HH recruiter pages sometimes drop stable message wrappers during SPA updates.
      // Keep the pencil available as long as the active page is clearly a negotiation/chat
      // and a reply composer is present.
      if(provider==='hh'&&/(?:\/applicant\/negotiations|\/negotiations|\/chat|\/messages)/i.test(path)&&getReplyInput())return 'RECRUITER_CHAT';
      if(detectApplicationForm())return 'APPLICATION_FORM';
      if(provider==='hh'&&root.vjaHhListSurfaces?.isListPage(doc,url))return 'JOB_LIST';
      const v=extractVacancy();
      // A direct HH vacancy URL is authoritative enough to keep the launcher visible
      // even while description blocks are still loading.
      if(provider==='hh'&&/\/vacancy\/\d+/i.test(path))return 'JOB_DESCRIPTION';
      if(provider==='avito'&&/\/vakansii\//i.test(path)&&Boolean(C.idFromUrl(url)))return 'JOB_DESCRIPTION';
      if(v.title&&(structured(doc)||v.description&&(/vacancy|job|career|position|requisition/i.test(url)||cfg.description?.length)))return 'JOB_DESCRIPTION';
      if(v.title&&/vacancy|job|career|position|requisition/i.test(url))return 'JOB_DESCRIPTION';
      if(provider==='avito'&&/\/vakansii(?:\/|$)/i.test(path)&&all('a[href*="/vakansii/"]',doc).length>1)return 'JOB_LIST';
      if(/(?:jobs|vacancies|search)/i.test(path)&&all('a[href*="/vacancy/"],a[href*="/jobs/"]',doc).length>2)return 'JOB_LIST';
      if(/interview|собеседование/i.test(path))return 'INTERVIEW_PAGE';
      if(/compan(?:y|ies)|about/i.test(path))return 'COMPANY_PAGE';
      return 'UNKNOWN';
    }
    function detectApplyButton(){
      return all('a[href]',doc).filter(visible).find(a=>C.safeApplyLink({label:text(a,120),href:a.href,base:url,inForm:Boolean(a.closest('form'))}))||null;
    }
    return {provider,extractVacancy,extractVacancyId:()=>extractVacancy().vacancyId||'',readFullVacancy:async()=>extractVacancy(doc),detectPageType,detectVacancy:()=>detectPageType()==='JOB_DESCRIPTION',detectApplicationForm,detectQuestionnaire:()=>{const form=detectApplicationForm();return form?{detected:true,form,fields:formFields(form).map(descriptor)}:{detected:false,form:null,fields:[]};},extractFormFields:()=>formFields(detectApplicationForm()||doc).map(descriptor),getReplyInput,chatRoot,getMessages,conversation,detectRecruiterChat:()=>conversation(),detectApplyButton,findApplyControl:()=>detectApplyButton(),detectApplicationStatus:()=>{const body=text(doc.body,5000);if(/отклик уже просмотрен работодателем/i.test(body))return 'VIEWED';if(/вы откликнулись|отклик отправлен|application submitted/i.test(body))return 'APPLIED';if(/отказ|rejected/i.test(body))return 'REJECTED';return 'UNKNOWN';}};
  }
  root.vjaSiteAdapters={profiles,make,all,visible,text,label,descriptor,formFields};
})(globalThis);
