(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaBundledCv=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='2026-09-23-v2';
  const specs={
    en:{key:'cvVaultEn',path:'assets/cv/Violetta_Nicolaou_CV_EN.pdf',name:'Violetta_Nicolaou_CV_EN.pdf',language:'en'},
    ru:{key:'cvVaultRu',path:'assets/cv/Violetta_Nicolaou_CV_RU.pdf',name:'Violetta_Nicolaou_CV_RU.pdf',language:'ru'}
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
  async function ensure({force=false,chromeApi=globalThis.chrome,fetchFn=globalThis.fetch}={}){
    if(!chromeApi?.storage?.local)return {ok:false,reason:'storage-unavailable'};
    const keys=[specs.en.key,specs.ru.key,'vjaBundledCvVersion'];
    const stored=await chromeApi.storage.local.get(keys);const patch={};const loaded=[];
    // 3.3.1 is the first build that ships the user-provided PDFs. On the first
    // run of this bundle version, install these exact files as the default
    // RU/EN slots even if an older base-slot CV existed. Later manual replaces
    // are preserved because the bundle version is already recorded.
    const installingThisBundle=stored.vjaBundledCvVersion!==VERSION;
    for(const spec of Object.values(specs)){
      const current=stored[spec.key];
      if(!force&&!installingThisBundle&&current?.base64)continue;
      const file=await load(spec,chromeApi,fetchFn);patch[spec.key]=file;loaded.push(spec.language);
    }
    if(force||installingThisBundle)patch.vjaBundledCvVersion=VERSION;
    if(Object.keys(patch).length)await chromeApi.storage.local.set(patch);
    return {ok:true,loaded,version:VERSION};
  }
  return {VERSION,specs,bytesToBase64,load,ensure};
});
