/* 5.0 multi-site adapter contract and registry. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaSiteAdapterCore=api;})(globalThis,function(){
  'use strict';const required=['detectPage','extractVacancy','extractVacancyId','readFullVacancy','findApplyControl','detectQuestionnaire','detectApplicationStatus','detectRecruiterChat'];
  function validate(adapter){if(!adapter||typeof adapter!=='object')return {ok:false,missing:required.slice()};const missing=required.filter(k=>typeof adapter[k]!=='function');return {ok:!missing.length,missing};}
  function registry(){const map=new Map();return {register(name,adapter){const r=validate(adapter);if(!r.ok)throw new Error(`Invalid adapter ${name}: ${r.missing.join(', ')}`);map.set(String(name),adapter);return adapter;},get:name=>map.get(String(name))||null,names:()=>[...map.keys()]};}
  function canonicalIdentity(source,id,fingerprint=''){return {source:String(source||'generic'),sourceVacancyId:String(id||''),canonicalFingerprint:String(fingerprint||'')};}
  return {required,validate,registry,canonicalIdentity};
});
