/* Explicit local file import. No network and no model-created candidate facts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.vjaPrivateProfile=api;})(globalThis,function(){
  'use strict';
  function validate(input){
    if(!input||input.format!=='violetta-private-profile'||input.schemaVersion!==1)throw new Error('Неподдерживаемый формат личного профиля.');
    const walk=(v,depth=0)=>{if(depth>25)throw new Error('Слишком глубокая структура.');if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw new Error('Небезопасный ключ.');walk(x,depth+1);}};walk(input);
    if(!input.profile||typeof input.profile!=='object'||!Array.isArray(input.profile.facts))throw new Error('В файле нет корректного профиля.');
    if(input.profile.facts.length>1000)throw new Error('Слишком много фактов.');
    for(const f of input.profile.facts)if(!f||typeof f.id!=='string'||!f.id||typeof f.text!=='string')throw new Error('У каждого факта должны быть id и text.');
    const ids=input.profile.facts.map(f=>f.id);if(new Set(ids).size!==ids.length)throw new Error('Повторяющиеся id фактов.');
    for(const [key,cv] of Object.entries(input.cv||{})){
      if(!['cvVaultEn','cvVaultRu'].includes(key)||!cv||cv.type!=='application/pdf'||typeof cv.base64!=='string'||cv.base64.length>24*1024*1024)throw new Error('Неподдерживаемый CV.');
      if(!/^[A-Za-z0-9+/]*={0,2}$/.test(cv.base64))throw new Error('Повреждённое содержимое CV.');
      let bytes;try{bytes=atob(cv.base64);}catch{throw new Error('Повреждённое содержимое CV.');}
      if(!bytes.startsWith('%PDF-')||bytes.length!==cv.size)throw new Error('Не совпадает формат или размер CV.');
    }
    return {facts:ids.length,cv:Object.keys(input.cv||{}).length,name:String(input.profile.fullName||'Без имени')};
  }
  function plan(input,current={},options={}){
    validate(input);if(options.confirmed!==true)throw new Error('Сначала подтвердите сведения профиля.');
    const old=current.vjaCandidateTruthProfile||{},incoming=JSON.parse(JSON.stringify(input.profile));
    const facts=new Map((old.facts||[]).map(f=>[f.id,f]));
    for(const f of incoming.facts)facts.set(f.id,{...f,origin:'user-confirmed',confirmedAt:options.now||Date.now(),priority:100,pendingReview:false});
    const profile={...old,...incoming,emptySeed:false,contacts:{...(old.contacts||{}),...(incoming.contacts||{})},facts:[...facts.values()],importedAt:options.now||Date.now()};
    const sources=new Map([...(old.sources||[]),...(incoming.sources||[])].map(s=>[s.id,s]));profile.sources=[...sources.values()];
    // A prior snapshot is checkpointed by the UI; unknown top-level storage is untouched.
    const patch={vjaCandidateTruthProfile:profile,vjaAutomationPolicyV1:{...(current.vjaAutomationPolicyV1||{}),mode:'assist',paused:true,explicitOptIn:false}};
    for(const [key,cv] of Object.entries(input.cv||{}))if(!current[key]?.base64||options.replaceCV===true)patch[key]={...cv,source:'private-import'};
    return patch;
  }
  return {validate,plan};
});
