(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaBundledCv=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='6.0-local-private-import';
  const specs={
    en:{key:'cvVaultEn',path:'private/candidate-en.pdf',name:'candidate-en.pdf',language:'en'},
    ru:{key:'cvVaultRu',path:'private/candidate-ru.pdf',name:'candidate-ru.pdf',language:'ru'}
  };
  function bytesToBase64(bytes){
    let binary='';const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    return btoa(binary);
  }
  async function load(spec,chromeApi=globalThis.chrome,fetchFn=globalThis.fetch){
    if(!chromeApi?.runtime?.getURL||typeof fetchFn!=='function')throw new Error('Bundled CV loader is unavailable.');
    const response=await fetchFn(chromeApi.runtime.getURL(spec.path));
    if(!response.ok)throw new Error(`Could not load ${spec.name}.`);
    const buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);
    if(bytes.length<5||bytes[0]!==0x25||bytes[1]!==0x50||bytes[2]!==0x44||bytes[3]!==0x46||bytes[4]!==0x2d)throw new Error(`${spec.name} is not a valid PDF.`);
    return {name:spec.name,type:'application/pdf',size:bytes.length,base64:bytesToBase64(bytes),savedAt:new Date().toISOString(),source:'bundled',bundleVersion:VERSION,language:spec.language};
  }
  async function ensure({chromeApi=globalThis.chrome}={}){
    if(!chromeApi?.storage?.local)return {ok:false,reason:'storage-unavailable'};
    const stored=await chromeApi.storage.local.get(['cvVaultEn','cvVaultRu']);
    const missing=Object.values(specs).filter(s=>!stored[s.key]?.base64).map(s=>s.language);
    return {ok:true,loaded:[],missing,needsImport:missing.length>0,version:VERSION};
  }
  return {VERSION,specs,bytesToBase64,load,ensure};
});
