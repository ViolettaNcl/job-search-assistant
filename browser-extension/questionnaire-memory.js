/* Questionnaire answer memory (5.2.0). */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.vjaQuestionnaireMemory=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const KEY='vjaQuestionnaireAnswerMemory:v1',MAX=300;
  let fallback={};
  async function read(){
    try{if(root.chrome?.storage?.local){return (await chrome.storage.local.get(KEY))[KEY]||{};}}catch{}
    return fallback;
  }
  async function write(value){
    fallback=value;
    try{if(root.chrome?.storage?.local)await chrome.storage.local.set({[KEY]:value});}catch{}
    return value;
  }
  async function get(semanticKey,{vacancyKey='',vacancySpecific=false,question=''}={}){
    if(!semanticKey)return null;const all=await read(),item=all[semanticKey];
    if(item){if(vacancySpecific&&String(item.vacancyKey||'')!==String(vacancyKey||''))return null;return item;}
    if(vacancySpecific||!question||!root.vjaSemanticIndex?.topK)return null;
    const category=String(semanticKey).split(':')[0]||'';const candidates=Object.values(all).filter(x=>x?.userConfirmed&&!x?.vacancyKey&&String(x?.answer||'').trim()&&String(x?.normalizedQuestion||'').trim()&&(!category||String(x.category||'')===category));
    const best=root.vjaSemanticIndex.topK(question,candidates,x=>x.normalizedQuestion,1)[0];
    if(!best||best.score<.25)return null;
    return {...best.item,retrievedBy:'semantic-hash-v1',similarity:best.score};
  }
  async function remember(entry={}){
    if(!entry.semanticKey||!String(entry.answer||'').trim())return null;
    const all=await read(),now=Date.now();
    all[entry.semanticKey]={semanticKey:String(entry.semanticKey),normalizedQuestion:String(entry.normalizedQuestion||'').slice(0,900),answer:String(entry.answer||'').slice(0,8000),source:String(entry.source||'').slice(0,120),confidence:Math.max(0,Math.min(1,Number(entry.confidence||0))),userConfirmed:Boolean(entry.userConfirmed),vacancyKey:String(entry.vacancyKey||'').slice(0,300),category:String(entry.category||'UNKNOWN').slice(0,60),evidenceIds:Array.isArray(entry.evidenceIds)?entry.evidenceIds.slice(0,20).map(String):[],updatedAt:now};
    const keys=Object.keys(all).sort((a,b)=>Number(all[b]?.updatedAt||0)-Number(all[a]?.updatedAt||0));for(const k of keys.slice(MAX))delete all[k];
    await write(all);return all[entry.semanticKey];
  }
  async function confirm(semanticKey,answer){const all=await read(),item=all[semanticKey];if(!item)return null;item.userConfirmed=true;if(String(answer||'').trim())item.answer=String(answer).trim().slice(0,8000);item.updatedAt=Date.now();await write(all);return item;}
  async function list(){return Object.values(await read()).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));}
  return {get,remember,confirm,list,KEY};
});
