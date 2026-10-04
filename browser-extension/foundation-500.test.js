const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const HERE=__dirname;
const ROOT=path.resolve(HERE,'..');
const readExtension=name=>fs.readFileSync(path.join(HERE,name),'utf8');
const readRoot=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');

test('5.0 manifest and background load learning foundation',()=>{
  const m=JSON.parse(readExtension('manifest.json'));
  assert.equal(m.version,'5.2.0');
  const bg=readExtension('background.js');
  for(const f of ['learning-core.js','duplicate-detector.js','recruiter-intelligence.js','site-adapter-core.js','outcome-analytics-v2.js'])assert.ok(bg.includes(f),f);
});

test('5.0 background exposes learning and interview operations',()=>{
  const bg=readExtension('copilot-background.js');
  for(const op of ['learning-summary','learning-export','learning-import','learning-reset','learning-feedback','interview-plan'])assert.ok(bg.includes(op),op);
});

test('5.0 UI clearly separates Fit from Calls and has explicit feedback',()=>{
  const ui=readExtension('hh-list-intelligence.js');
  assert.match(ui,/Fit ≠ Calls/);
  assert.match(ui,/Без звонков/);
  assert.match(ui,/Есть звонки/);
  assert.match(ui,/learning-feedback/);
});

test('Learning Center is reachable from popup',()=>{
  assert.match(readExtension('home.html'),/Learning Center/);
  assert.match(readExtension('home.js'),/learning\.html/);
  assert.ok(fs.existsSync(path.join(HERE,'learning.html')));
  assert.ok(fs.existsSync(path.join(HERE,'learning.js')));
});

test('ML tooling is explicit about real labels and promotion gates',()=>{
  const train=readRoot('tools/ml/train_preference.py');
  const promote=readRoot('tools/ml/promote_model.py');
  assert.match(train,/REAL user labels/);
  assert.match(promote,/trainedOnRealLabels/);
  assert.match(promote,/Refusing promotion/);
});
