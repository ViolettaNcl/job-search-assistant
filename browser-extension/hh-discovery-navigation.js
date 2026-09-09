(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaHhNavigation=api;})(typeof self!=='undefined'?self:null,()=>{
  function parse(value){
    try {
      const u=new URL(value);
      if(u.protocol!=='https:'||u.port||u.username||u.password||!/(^|\.)hh\.ru$/.test(u.hostname))return null;
      const path=u.pathname.replace(/\/+$/,'');
      return {url:u,path,id:/^\/vacancy\/(\d+)$/.exec(path)?.[1]};
    } catch{return null;}
  }
  function sameTask(expected,actual){
    const a=parse(expected),b=parse(actual);if(!a||!b)return false;
    if(a.id)return a.id===b.id;
    if(a.path!=='/search/vacancy'||b.path!==a.path)return false;
    const text=u=>(u.searchParams.get('text')||'').trim().replace(/\s+/g,' ').toLowerCase();
    if(text(a.url)!==text(b.url))return false;
    // Added tracking/region parameters do not change the search identity; retain explicit filters.
    for(const key of ['schedule','experience','area','professional_role']) {
      const expectedValues=a.url.searchParams.getAll(key).sort();
      if(expectedValues.length&&JSON.stringify(expectedValues)!==JSON.stringify(b.url.searchParams.getAll(key).sort()))return false;
    }
    return true;
  }
  const legacyRedirect='Поиск через сайт HH остановлен: HH перенаправил страницу. Проверьте вход и доступ во вкладке.';
  return {sameTask,legacyRedirect};
});
