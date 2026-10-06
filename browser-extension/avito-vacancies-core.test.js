'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const V=require('./avito-vacancies-core.js');
const C=require('./copilot-core.js');
const R=require('./relevance-engine.js');

const detail='https://www.avito.ru/volgogradskaya_oblast_volzhskiy/vakansii/nachinayuschiy_specialist_na_vhodyaschuyu_liniyu_udaleno_138107116?context=H4sIAAAAAAAA';

test('Avito provider uses an exact domain boundary',()=>{
  assert.equal(C.provider(detail),'avito');
  assert.equal(C.provider('https://avito.ru.attacker.invalid/vakansii/job_138107116'),'generic');
  assert.equal(V.isSupportedHost('https://m.avito.ru/vakansii/job_138107116'),true);
});

test('Avito vacancy identity is extracted from the numeric slug suffix',()=>{
  assert.equal(C.idFromUrl(detail),'138107116');
  assert.equal(V.vacancyIdFromUrl(detail),'138107116');
  assert.equal(V.isVacancyUrl(detail),true);
});

test('Avito tracking context does not change canonical vacancy identity',()=>{
  const clean='https://www.avito.ru/volgogradskaya_oblast_volzhskiy/vakansii/nachinayuschiy_specialist_na_vhodyaschuyu_liniyu_udaleno_138107116';
  assert.equal(C.canonicalUrl(detail),C.canonicalUrl(clean));
  assert.equal(C.sameVacancy({url:detail},{url:clean}),true);
});

test('Avito search and detail routes are separated',()=>{
  assert.equal(V.isListUrl('https://www.avito.ru/volgogradskaya_oblast_volzhskiy/vakansii?cd=1'),true);
  assert.equal(V.isListUrl(detail),false);
  assert.equal(V.isVacancyUrl('https://www.avito.ru/volgogradskaya_oblast_volzhskiy/vakansii'),false);
});

test('Avito result helpers keep Calls and Fit independent',()=>{
  assert.equal(V.callsState({status:'calls'}),'calls');
  assert.equal(V.callsState({status:'no-calls'}),'no-calls');
  assert.equal(V.fitState({score:91}),'strong');
  assert.equal(V.fitState({score:83}),'match');
  assert.equal(V.filterMatches({fit:{score:91},analysis:{status:'calls'}},'strong'),true);
  assert.equal(V.filterMatches({fit:{score:91},analysis:{status:'calls'}},'no-calls'),false);
});

test('Avito content bundle is declared without HH auto-submit scripts',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
  assert.ok(manifest.host_permissions.includes('https://*.avito.ru/*'));
  const avito=manifest.content_scripts.find(x=>x.matches?.some(m=>m.includes('avito.ru')));
  assert.ok(avito);
  assert.ok(avito.js.includes('avito-vacancies.js'));
  assert.equal(avito.js.includes('site-apply-content.js'),false);
  assert.equal(avito.js.includes('submission-guard-content.js'),false);
});


test('cover-letter policy keeps feminine Russian voice and always appends confirmed contacts',()=>{
  const profile={
    contacts:{telegram:'@candidate_fixture',email:'candidate@example.invalid'},
    facts:[],github:''
  };
  const text=R.personalizeCover('Здравствуйте! Я готов обсудить вакансию. Ранее работал с клиентскими обращениями.',profile,'ru');
  assert.match(text,/Я готова обсудить/);
  assert.match(text,/работала/);
  assert.match(text,/@candidate_fixture/);
  assert.match(text,/candidate@example\.invalid/);
  assert.doesNotMatch(text,/\bбуду рад\b|\bя готов\b|\bработал\b/i);
});

test('Avito manifest advertises explicit one-click message sending, not copy-only mode',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
  assert.match(manifest.description,/явного нажатия «Письмо»/);
  assert.match(manifest.version_name,/One-Click Message BETA/);
});
