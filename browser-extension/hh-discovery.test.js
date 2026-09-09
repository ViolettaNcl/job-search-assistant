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
console.log('HH browser discovery challenge stops, URL validation and duplicate signals passed');
