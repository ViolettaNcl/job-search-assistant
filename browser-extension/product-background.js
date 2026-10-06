/* Extends the existing worker. Only extension-owned pages can invoke administrative operations. */
'use strict';
let cpShadowWriteQueue=Promise.resolve();
async function cpSetShadow(version){
 const reg=await cpModelRegistry();if(version&&!reg.models.some(e=>e.modelVersion===version))throw new Error('Candidate model not found.');
 const old=(await chrome.storage.local.get('vjaProductSettingsV1')).vjaProductSettingsV1||{};
 await chrome.storage.local.set({vjaProductSettingsV1:{...old,shadowModel:version||null}});return {shadowModel:version||null};
}
async function cpCaptureShadow(vacancy,fit){
 const settings=(await chrome.storage.local.get('vjaProductSettingsV1')).vjaProductSettingsV1||{};if(!settings.shadowModel)return;
 const reg=await cpModelRegistry(),entry=reg.models.find(e=>e.modelVersion===settings.shadowModel);if(!entry||entry.kind==='engagement')return;
 await globalThis.vjaProductModels.verify(entry);const p=await cpModelRuntime.predict(entry.model,cpModelRuntime.rowFromFit(vacancy,fit));
 const sample={vacancyId:vacancy.vacancyId,provider:vacancy.provider||'hh',modelVersion:p.modelVersion,at:Date.now(),probability:p.probability,threshold:p.threshold,baseScore:fit.rulesScoreBeforeMl,basePositive:Number(fit.rulesScoreBeforeMl)>=Number(fit.preferences?.minimumFitScore||80)};
 const write=cpShadowWriteQueue.then(async()=>{const old=(await chrome.storage.local.get('vjaShadowPredictionsV1')).vjaShadowPredictionsV1||[];const out=old.filter(x=>!(x.vacancyId===sample.vacancyId&&x.provider===sample.provider&&x.modelVersion===sample.modelVersion));await chrome.storage.local.set({vjaShadowPredictionsV1:[...out,sample].slice(-5000)});});cpShadowWriteQueue=write.catch(()=>null);await write;
}
async function cpRollbackModel(kind){
 if(!['preference','engagement'].includes(kind))throw new Error('Unknown model target.');
 const reg=await cpModelRegistry(),prev=reg.previousModels?.[kind],entry=reg.models.find(e=>e.modelVersion===prev);if(!entry)throw new Error('No previous model retained. Disable ML instead.');
 cpModelRuntime.validate(entry.model);await globalThis.vjaProductModels.verify(entry);
 const current=reg.activeModels[kind];for(const e of reg.models)if(e.kind===kind&&e.status==='active')e.status='superseded';entry.status='active';reg.activeModels[kind]=prev;if(kind==='preference')reg.activeModel=prev;reg.previousModels={...(reg.previousModels||{}),[kind]:current};reg.updatedAt=Date.now();
 const flags=(await chrome.storage.local.get(cpFeatureFlagsKey))[cpFeatureFlagsKey]||{};await chrome.storage.local.set({[cpModelRegistryKey]:reg,[cpFeatureFlagsKey]:{...flags,...(kind==='preference'?{mlRanking:true}:{})}});return reg;
}
async function cpRestoreProduct(data){
 await cpLearningWriteQueue;
 return applicationStateChange(async()=>{
   const current=await chrome.storage.local.get(null),syncCurrent=await chrome.storage.sync.get(null);
   const busy=Object.entries(current).some(([k,v])=>k.startsWith('vjaApplicationJob:')&&v?.tabId&&!v.completed&&!v.review);
   if(busy)throw new Error('Сначала завершите или остановите текущие отклики.');
   const plan=globalThis.vjaProductCore.restorePlan(data,current);
   const migration=globalThis.vjaProductMigrations.plan({...current,...plan.patch});
   Object.assign(plan.patch,migration.patch);
   try{
     await chrome.storage.local.set(plan.patch);
     await chrome.storage.sync.set(plan.syncPatch);
     const actual=await chrome.storage.local.get(Object.keys(plan.patch)),syncActual=await chrome.storage.sync.get(Object.keys(plan.syncPatch));
     for(const [k,v] of Object.entries(plan.syncPatch))if(JSON.stringify(syncActual[k])!==JSON.stringify(v))throw new Error('Sync restore verification failed.');
     for(const [k,v] of Object.entries(plan.patch))if(JSON.stringify(actual[k])!==JSON.stringify(v))throw new Error('Restore verification failed.');
     if(globalThis.indexedDB)await globalThis.vjaProductStore.mirror(actual);
     cpInit=null;return {restored:plan.keyCount,paused:true,verified:true};
   }catch(error){
     const newKeys=Object.keys(plan.patch).filter(k=>!(k in current));
     await chrome.storage.local.set(current);if(newKeys.length)await chrome.storage.local.remove(newKeys);
     await chrome.storage.sync.set(syncCurrent);
     const syncNew=Object.keys(plan.syncPatch).filter(k=>!(k in syncCurrent));if(syncNew.length)await chrome.storage.sync.remove(syncNew);
     await chrome.storage.local.set({vjaIndexRetryRequired:true});
     cpInit=null;throw new Error('Восстановление отменено; предыдущая память возвращена. Индекс будет перестроен.');
   }
 });
}
