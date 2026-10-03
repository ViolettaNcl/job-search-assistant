const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');

test('4.0 manifest loads ranking and batch surfaces after exact HH quick-apply',()=>{const m=JSON.parse(read('manifest.json'));const js=m.content_scripts.find(x=>x.js.includes('hh-list-quick-apply.js')).js;assert.equal(m.version,'4.0.0');assert.ok(js.indexOf('vacancy-fit.js')>js.indexOf('hh-list-quick-apply.js'));assert.ok(js.indexOf('hh-list-intelligence.js')>js.indexOf('vacancy-fit.js'));});

test('4.0 service worker imports explainable fit rules before copilot background',()=>{const bg=read('background.js');assert.match(bg,/vacancy-fit\.js/);assert.ok(bg.indexOf('vacancy-fit.js')<bg.lastIndexOf('copilot-background.js'));});

test('4.0 background exposes full analysis, preference and decision operations',()=>{const bg=read('copilot-background.js');for(const op of ['quick-list-full-analysis','job-preferences-get','job-preferences-save','quick-list-decision'])assert.ok(bg.includes(op),op);assert.ok(bg.includes('vjaVacancyIntel:'));assert.ok(bg.includes('vjaJobPreferencesV1'));});

test('4.0 batch UI remains user-controlled and concurrency-bounded',()=>{const ui=read('hh-list-intelligence.js');assert.match(ui,/Analyze page/);assert.match(ui,/Очередь/);assert.match(ui,/batchConcurrency/);assert.match(ui,/Math\.min\(preferences\.batchConcurrency/);assert.doesNotMatch(ui,/\.click\(\).*automatic|auto.?submit/i);});

test('4.0 scoring is explicitly rules-v1 rather than fake ML',()=>{const fit=read('vacancy-fit.js');assert.match(fit,/algorithm:'rules-v1'/);assert.match(fit,/Deterministic rules only: no ML claims/);});
