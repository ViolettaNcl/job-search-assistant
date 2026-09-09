const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync(__dirname+'/hh-discovery-content.js','utf8');
function read({hostname='hh.ru',pathname='/search/vacancy',text='',challenge=false,links=[],vacancy={}}={}) {
  let listener,response;
  const window={};window.top=window;
  vm.runInNewContext(script,{chrome:{runtime:{onMessage:{addListener:f=>listener=f}}},window,location:{hostname,pathname},URL,
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
  async function simulate({blocked=false, enabled=true}={}) {
    const data=blocked?{vjaHhDiscoveryBlocked:'Needs manual verification'}:{};
    let opened=0,imports=0,reads=0,tab={id:1,status:'complete',url:''};
    const local={get:async()=>data,set:async v=>Object.assign(data,v),remove:async key=>{for(const k of [].concat(key))delete data[k];}};
    const context={URL,Date,setTimeout,clearTimeout,Promise,self:{vjaBrowserAutopilot:{shouldRun:s=>s.autoApplyEnabled,hasSafeSeniority:()=>true}},
      chrome:{storage:{local,sync:{get:async()=>({vjaHhBrowserSearch:true})}},tabs:{create:async v=>{opened++;tab.url=v.url;return tab;},get:async()=>tab,update:async(id,v)=>{Object.assign(tab,v);return tab;},remove:async()=>{},sendMessage:async()=>++reads===1?{links:['https://hh.ru/vacancy/123']}:{vacancy:{url:tab.url,title:'Junior C#',description:'C# SQL'}}}},
      browserAutopilotWait:async()=>{},browserAutopilotHeartbeat:async()=>{},browserAutopilotJson:async url=>{if(url.endsWith('/api/import/browser')){imports++;return{};}return{autoApplyEnabled:enabled};}};
    vm.createContext(context);vm.runInContext(source,context);await context.discoverHhInBrowser('http://localhost:8080',{browserSearchQueries:['Junior C#']});
    return {opened,imports};
  }
  assert.deepEqual(await simulate({blocked:true}),{opened:0,imports:0});
  assert.deepEqual(await simulate({enabled:false}),{opened:1,imports:0});
  assert.deepEqual(await simulate(),{opened:1,imports:1});
  console.log('HH discovery adapter observes manual-review stop and backend pause');
})().catch(e=>{console.error(e);process.exitCode=1;});
