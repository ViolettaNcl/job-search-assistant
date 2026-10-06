/* Metadata-only logs. Error messages and arbitrary page/profile text are deliberately not accepted. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaStructuredLog=api;})(globalThis,function(root){
  'use strict';const KEY='vjaDiagnosticLogV1';let queue=Promise.resolve(),memory=[];
  const token=(x,n=64)=>/^[A-Za-z0-9_.:-]+$/.test(String(x||''))?String(x).slice(0,n):'redacted';
  function entry(input={},now=Date.now()){return {level:['INFO','WARN','ERROR'].includes(input.level)?input.level:'INFO',timestamp:now,version:root.chrome?.runtime?.getManifest?.().version||'6.0.0',pageType:token(input.pageType||'extension'),vacancyId:/^\d{1,24}$/.test(String(input.vacancyId||''))?String(input.vacancyId):null,module:token(input.module||'runtime'),code:token(input.code||'UNKNOWN')};}
  function write(input){const e=entry(input);const next=queue.then(async()=>{const local=root.chrome?.storage?.local;const rows=local?((await local.get(KEY))[KEY]||[]):memory;memory=[...rows,e].slice(-1000);if(local)await local.set({[KEY]:memory});return e;});queue=next.catch(()=>{});return next;}
  async function list(){await queue;const local=root.chrome?.storage?.local;return local?((await local.get(KEY))[KEY]||[]):[...memory];}
  return {KEY,entry,write,list};
});
