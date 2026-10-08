const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const S=require('./hh-list-surfaces.js');
for(const origin of ['https://hh.ru','https://volgograd.hh.ru','https://headhunter.kg']){
  test(`HH feed: ${origin} homepage requires a real vacancy card, not just an URL`,()=>{
    assert.equal(S.pageKind(`${origin}/?utm_source=google&utm_term=headhunter`,false),'');
    assert.equal(S.pageKind(`${origin}/?utm_source=google&utm_term=headhunter`,true),'recommendations');
  });
}
test('HH search keeps its toolbar even while the cards are still loading',()=>{
  for(const path of ['/search/vacancy?text=support','/vacancy/search','/vacancies'])assert.equal(S.pageKind('https://hh.ru'+path,false),'search');
});
test('HH application, profile and recruiter pages never become batch lists',()=>{
  for(const p of ['/vacancy/779','/vacancy/779?from=search','/applicant/negotiations','/chat/123','/resume/123','/vacancy_response?vacancyId=779','/applicant/questionnaire','/account/login'])assert.equal(S.pageKind('https://hh.ru'+p,true),'',p);
});
test('Feed selection queries and extra URLs do not become vacancy IDs',()=>{
  assert.equal(S.vacancyId('https://headhunter.kg/?utm_campaign=vacancy/779'),'');
  assert.equal(S.vacancyId('https://headhunter.kg/vacancy/779?from=for_you'),'779');
  assert.equal(S.vacancyId('https://hh.ru/vacancy/779123_extra'),'');
});
test('External, Avito, API and spoofed HH hosts do not receive the HH list UI',()=>{
  for(const url of ['https://avito.ru/vakansii/','https://career.habr.com/vacancies','https://hh.ru.evil.example/','https://api.hh.ru/vacancies/779','file:///vacancies'])assert.equal(S.pageKind(url,true),'',url);
  assert.equal(S.vacancyId('https://example.org/vacancy/779'),'');
});
test('A tracking query containing search/vacancy cannot turn an unrelated page into a list',()=>{
  assert.equal(S.pageKind('https://hh.ru/article?utm_campaign=search/vacancy',false),'');
});
test('HH DOM surface helpers are loaded before adapters and quick-apply in the real manifest',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
  const hh=m.content_scripts.find(x=>x.js.includes('hh-list-quick-apply.js')).js;
  assert.ok(hh.indexOf('hh-list-surfaces.js')>=0);
  assert.ok(hh.indexOf('hh-list-surfaces.js')<hh.indexOf('site-adapters.js'));
  assert.ok(hh.indexOf('hh-list-surfaces.js')<hh.indexOf('hh-list-quick-apply.js'));
  const avito=m.content_scripts.find(x=>x.js.includes('avito-vacancies.js')).js;
  assert.ok(!avito.includes('hh-list-surfaces.js'));
});
test('HH list classification is shared by quick apply, batch and the page adapter',()=>{
  const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
  assert.match(read('hh-list-quick-apply.js'),/S\.isListPage\(document,location\.href\)/);
  assert.match(read('hh-list-intelligence.js'),/R\.isListPage\(\)/);
  assert.match(read('site-adapters.js'),/vjaHhListSurfaces\?\.isListPage\(doc,url\)/);
});
