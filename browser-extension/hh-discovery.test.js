const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const navigation=require('./hh-discovery-navigation.js');
const script=fs.readFileSync(__dirname+'/hh-discovery-content.js','utf8');
function read({hostname='hh.ru',pathname='/search/vacancy',text='',challenge=false,links=[],vacancy={}}={}) {
  let listener,response;
  const window={};window.top=window;
  vm.runInNewContext(script,{chrome:{runtime:{onMessage:{addListener:f=>listener=f}}},window,self:{vjaHhNavigation:navigation},location:{hostname,pathname,href:'https://'+hostname+pathname},URL,
    document:{body:{innerText:text},querySelector:()=>challenge?{}:null,querySelectorAll:()=>links.map(href=>({href}))},extractPage:()=>vacancy});
  listener({type:'vjaReadHhDiscovery'},{},r=>response=r);return response;
}
assert(read({challenge:true,links:['https://hh.ru/vacancy/1']}).blocked);
assert(read({text:'VPN мешает работе сайта'}).blocked);
assert(read({hostname:'hh.ru.attacker.example'}).blocked);
assert.deepEqual(Array.from(read({links:['https://hh.ru/vacancy/1?a=b','https://hh.ru/vacancy/1','https://hh.ru.evil/vacancy/2','https://linkedin.com/jobs/1']}).links),['https://hh.ru/vacancy/1']);
assert(read({pathname:'/vacancy/1',text:'Резюме доставлено'}).alreadyApplied);
assert(read({pathname:'/vacancy/1',vacancy:{title:'Junior C#',description:'short'}}).blocked);
assert.equal(read({pathname:'/vacancy/1',vacancy:{title:'Junior C#',description:'C# SQL '.repeat(30)}}).vacancy.title,'Junior C#');
assert.equal(read({pathname:'/vacancy/1',text:'Рекомендуем: удаленная работа',vacancy:{title:'Junior C#',description:'C# SQL '.repeat(30),remote:true}}).vacancy.remote,false,'recommended jobs must not make current vacancy remote');
console.log('HH browser discovery challenge stops, URL validation and duplicate signals passed');

// Exercise the background adapter with mocked Chrome/API: no network or employer actions.
(async()=>{
  const source=fs.readFileSync(__dirname+'/hh-discovery-background.js','utf8');
  async function simulate({blocked=false, enabled=true, regional=false, legacy=false, stale=false}={}) {
    const data=legacy?{vjaHhDiscoveryBlocked:navigation.legacyRedirect,vjaHhDiscoveryAt:Date.now()}:blocked?{vjaHhDiscoveryBlocked:'Needs manual verification'}:{};
    const redirect=url=>regional?url.replace('https://hh.ru/','https://volgograd.hh.ru/'):url;
    let opened=0,imports=0,reads=0,tab={id:1,status:'complete',url:''};
    const local={get:async()=>data,set:async v=>Object.assign(data,v),remove:async key=>{for(const k of [].concat(key))delete data[k];}};
    const context={URL,Date,setTimeout,clearTimeout,Promise,self:{vjaHhNavigation:navigation,vjaBrowserAutopilot:{shouldRun:s=>s.autoApplyEnabled,hasSafeSeniority:()=>true}},
      chrome:{storage:{local,sync:{get:async()=>({vjaHhBrowserSearch:true})}},tabs:{create:async v=>{opened++;tab.url=redirect(v.url);return tab;},get:async()=>tab,update:async(id,v)=>{Object.assign(tab,v);if(v.url)tab.url=redirect(v.url);return tab;},remove:async()=>{},sendMessage:async()=>++reads===1?{pageUrl:tab.url,links:['https://hh.ru/vacancy/123']}:{pageUrl:stale?'https://hh.ru/vacancy/999':tab.url,vacancy:{url:tab.url,title:'Junior C#',description:'C# SQL'}}}},
      browserAutopilotWait:async()=>{},browserAutopilotHeartbeat:async()=>{},browserAutopilotJson:async url=>{if(url.endsWith('/api/import/browser')){imports++;return{};}return{autoApplyEnabled:enabled};}};
    vm.createContext(context);vm.runInContext(source,context);await context.discoverHhInBrowser('http://localhost:8080',{browserSearchQueries:['Junior C#']});
    return {opened,imports};
  }
  assert.deepEqual(await simulate({blocked:true}),{opened:0,imports:0});
  assert.deepEqual(await simulate({enabled:false}),{opened:1,imports:0});
  assert.deepEqual(await simulate(),{opened:1,imports:1});
  assert.deepEqual(await simulate({regional:true}),{opened:1,imports:1});
  assert.deepEqual(await simulate({legacy:true,regional:true}),{opened:1,imports:1});
  assert.deepEqual(await simulate({stale:true}),{opened:1,imports:0});
  console.log('HH discovery adapter observes manual-review stop and backend pause');
})().catch(e=>{console.error(e);process.exitCode=1;});

assert(navigation.sameTask('https://hh.ru/search/vacancy?text=Junior%20C%23&order_by=publication_time','https://volgograd.hh.ru/search/vacancy/?order_by=publication_time&text=Junior+C%23&hhtmFrom=main'));
assert(navigation.sameTask('https://hh.ru/vacancy/123','https://volgograd.hh.ru/vacancy/123/?from=search#top'));
for(const url of ['https://hh.ru/vacancy/456','https://hh.ru/account/login','https://hh.ru/captcha','https://hh.ru.attacker.com/vacancy/123','https://evilhh.ru/vacancy/123','http://hh.ru/vacancy/123']) assert.equal(navigation.sameTask('https://hh.ru/vacancy/123',url),false);
assert.equal(navigation.sameTask('https://hh.ru/search/vacancy?text=C%23&schedule=remote','https://hh.ru/search/vacancy?text=C%23'),false);
assert.equal(navigation.sameTask('https://hh.ru/search/vacancy?text=C%23','https://hh.ru/search/vacancy?text=sales'),false);

// Run the real page extraction functions against DOM fixtures, not a replacement extractor.
const extractionSource = fs.readFileSync(__dirname+'/content.js','utf8').split('function textByIds(')[0];
function extractHh(description) {
  const context = {window:{vjaAtsStructured:{detectAtsHost:()=> 'hh'}},location:{hostname:'hh.ru',href:'https://hh.ru/vacancy/123'},
    document:{title:'Junior C#',body:{innerText:'Рекомендуем: удаленная работа'},querySelector:selector => selector === "[data-qa='vacancy-description']" && description ? {innerText:description} : null}};
  vm.createContext(context); vm.runInContext(extractionSource, context);
  return context.extractPage();
}
assert.equal(extractHh('C# SQL in our office').remote,false);
assert.equal(extractHh('C# SQL, удалённая работа').remote,true);
assert.equal(extractHh(null).remote,false,'missing HH description cannot use recommendation text');
assert.equal(extractHh(null).description,'');
console.log('Real HH extraction ignores recommendations and stops on missing description');
