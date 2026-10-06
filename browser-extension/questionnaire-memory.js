/* Confirmed answer retrieval. Serialized writes, explicit scope, lossless edit history. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaQuestionnaireMemory=api;})(globalThis,function(root){
  'use strict';const KEY='vjaQuestionnaireMemoryV1';let fallback={},queue=Promise.resolve();
  const forbidden=new Set(['__proto__','constructor','prototype']);
  const text=(x,n=8000)=>String(x??'').trim().slice(0,n);
  const pageContext=()=>typeof location!=='undefined'&&/^https?:$/.test(location.protocol);
  async function gateway(action,args={}){const r=await root.chrome.runtime.sendMessage({type:'vjaCopilot',op:'questionnaire-memory',action,...args});if(!r?.ok)throw new Error(r?.error||'Память ответов недоступна.');return r.value;}
  async function read(){if(root.chrome?.storage?.local)return (await root.chrome.storage.local.get(KEY))[KEY]||{};return fallback;}
  async function write(value){if(root.chrome?.storage?.local)await root.chrome.storage.local.set({[KEY]:value});fallback=value;return value;}
  function serial(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
  function inScope(x,vacancyKey){return !x.vacancyKey||x.reusable===true||String(x.vacancyKey)===String(vacancyKey);}
  async function get(semanticKey,{vacancyKey='',vacancySpecific=false,question=''}={}){
    if(pageContext())return gateway('get',{key:semanticKey,options:{vacancyKey,vacancySpecific,question}});
    if(!semanticKey||forbidden.has(semanticKey))return null;
    return serial(async()=>{const all=await read();const scopeKey=`${semanticKey}::scope:${vacancyKey}`;
      let item=all[scopeKey]||all[semanticKey];
      if(item&&(!inScope(item,vacancyKey)||(vacancySpecific&&!item.reusable&&String(item.vacancyKey||'')!==String(vacancyKey))))item=null;
      if(!item)item=Object.values(all).filter(x=>x?.semanticKey===semanticKey&&x.userConfirmed&&x.reusable===true).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0]||null;
      if(!item&&question&&root.vjaSemanticIndex?.topK){
        const category=String(semanticKey).split(':')[0];
        // Only broad lexical retrieval for non-factual subjective wording. Language levels have stable keys.
        const candidates=Object.values(all).filter(x=>x?.userConfirmed&&inScope(x,vacancyKey)&&(!vacancySpecific||x.reusable||String(x.vacancyKey)===String(vacancyKey))&&x.category===category&&x.answer&&x.normalizedQuestion);
        const best=root.vjaSemanticIndex.topK(question,candidates,x=>x.normalizedQuestion,1)[0];
        const safeCategory=['ENGLISH_LEVEL','RUSSIAN_LEVEL','GREEK_LEVEL','FRENCH_LEVEL','WHY_COMPANY','WHY_ROLE','MOTIVATION','CONFLICT_RESOLUTION','TROUBLESHOOTING'].includes(category);
        if(best&&safeCategory&&best.score>=.25)item={...best.item,retrievedBy:'semantic-hash-v1',similarity:best.score};
      }
      if(!item)return null;
      const storageKey=Object.keys(all).find(k=>all[k].semanticKey===item.semanticKey&&String(all[k].vacancyKey||'')===String(item.vacancyKey||''));
      if(storageKey){all[storageKey]={...all[storageKey],lastUsedAt:Date.now()};await write(all);}
      return {...item,lastUsedAt:Date.now()};
    });
  }
  async function remember(entry={}){
    if(pageContext())return gateway('remember',{entry});
    if(forbidden.has(entry.semanticKey))throw new Error('Invalid semantic key');
    if(!entry.semanticKey||!text(entry.answer))return null;
    return serial(async()=>{const all=await read(),now=Date.now(),vacancyKey=text(entry.vacancyKey||entry.vacancyId,300),semanticKey=text(entry.semanticKey,500);
      const key=vacancyKey?`${semanticKey}::scope:${vacancyKey}`:semanticKey;
      const previous=all[key]||(!vacancyKey?all[semanticKey]:null)||{};
      // Automated drafts never demote or overwrite an explicitly confirmed answer.
      if(previous.userConfirmed&&!entry.userConfirmed)return previous;
      const history=Array.isArray(previous.editHistory)?[...previous.editHistory]:[];
      if(previous.answer&&previous.answer!==text(entry.answer))history.push({answer:previous.answer,at:previous.updatedAt||now,source:previous.source||'',userConfirmed:!!previous.userConfirmed});
      all[key]={...previous,semanticKey,normalizedQuestion:text(entry.normalizedQuestion,1000),originalWording:text(entry.originalWording||entry.question||entry.normalizedQuestion,1400),answer:text(entry.answer),vacancyKey,vacancyId:vacancyKey,company:text(entry.company,300),confidence:Math.max(0,Math.min(1,Number(entry.confidence)||0)),source:text(entry.source,120),userConfirmed:entry.userConfirmed===true,reusable:entry.reusable===true||(!vacancyKey&&entry.reusable!==false),category:text(entry.category||semanticKey.split(':')[0],60),evidenceIds:Array.isArray(entry.evidenceIds)?entry.evidenceIds.map(x=>text(x,200)).slice(0,20):[],createdAt:previous.createdAt||now,updatedAt:now,lastUsedAt:previous.lastUsedAt||null,editHistory:history};
      await write(all);return all[key];
    });
  }
  async function confirm(semanticKey,answer,options={}){
    if(pageContext())return gateway('confirm',{key:semanticKey,answer,options});
    const item=await get(semanticKey,options);if(!item)return null;return remember({...item,answer:text(answer)||item.answer,userConfirmed:true,source:'explicit-user-confirmation'});
  }
  async function list(){await queue;return Object.values(await read()).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));}
  return {KEY,get,remember,confirm,list};
});
