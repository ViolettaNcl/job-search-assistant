'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
test('dedicated Apply + letter no longer stops with the legacy saved-letter toast',()=>{
  const js=read('hh-list-quick-apply.js');
  assert.doesNotMatch(js,/Письмо сохранено\. Откройте вакансию/);
  assert.match(js,/userInitiatedSubmit:true/);
  assert.match(js,/intent:'quick-list-apply-letter'/);
});
test('submission authorization carries explicit user intent to the worker',()=>{
  const guard=read('submission-guard-content.js'),worker=read('production-background.js');
  assert.match(guard,/userInitiated:plan\.userInitiated===true/);
  assert.match(worker,/userInitiated:m\.userInitiated===true/);
  assert.match(worker,/intent:String\(m\.intent\|\|''\)/);
  assert.match(worker,/knownHostSuffixes:\['hh\.ru','headhunter\.kg','career\.habr\.com'\]/);
});
test('quick-list preparation still requires the full vacancy reader before writing',()=>{
  const writing=read('writing-background.js'),worker=read('copilot-background.js');
  assert.match(writing,/cpAcquireHhVacancy\(v,sender,\{fast:Boolean\(embedded\)\}\)/);
  assert.match(worker,/chrome\.tabs\.create\(\{url:canonical,active:false\}\)/);
  assert.match(worker,/chrome\.tabs\.remove\(tab\.id\)/);
});

test('search-page native and extension Apply buttons both preserve explicit one-click intent',()=>{const js=read('hh-list-quick-apply.js');assert.match(js,/run\(target,card,vacancy,preparePromise,\{userInitiatedSubmit:true\}\)/);assert.match(js,/clickCoverLetterSendUntilClosed/);});
test('direct vacancy Apply propagates one-shot user intent through the worker plan',()=>{const page=read('universal-content.js'),worker=read('copilot-background.js');assert.match(page,/userInitiated:true,intent:'vacancy-page-apply-letter'/);assert.match(worker,/userInitiated:options\.userInitiated===true/);assert.match(worker,/intent:String\(options\.intent\|\|'vacancy-page-apply-letter'\)/);});
test('risk scan is scoped to active application UI rather than unrelated search filters',()=>{const guard=read('submission-guard-content.js');assert.match(guard,/activeApplicationScope/);assert.match(guard,/A\?\.formFields\?\.\(scope\)/);});

test('HH cover-letter Send retries are bounded and verified on list and vacancy pages',()=>{
  const list=read('hh-list-quick-apply.js'),page=read('site-apply-content.js');
  assert.match(list,/clickCoverLetterSendUntilClosed/);
  assert.match(list,/maxAttempts=6/);
  assert.match(list,/Never trust a page-wide success label/);
  assert.match(list,/for\(let attempt=1;attempt<=maxAttempts;attempt\+\+\)/);
  assert.match(page,/vjaSiteSubmitHhCoverLetterWithRetry/);
  assert.match(page,/submitAttempts:\s*submission\.attempts/);
  assert.match(page,/maxAttempts:6/);
  assert.match(page,/current modal after its editor is/);
});
