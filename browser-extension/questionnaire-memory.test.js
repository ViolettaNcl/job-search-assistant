const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./questionnaire-memory.js');

test('questionnaire memory stores and retrieves a safe answer',async()=>{const e=await M.remember({semanticKey:'ENGLISH_LEVEL',normalizedQuestion:'english',answer:'Fluent',source:'confirmed-profile',confidence:.9,userConfirmed:false,category:'ENGLISH_LEVEL'});assert.equal(e.answer,'Fluent');assert.equal((await M.get('ENGLISH_LEVEL')).answer,'Fluent');});
test('vacancy-specific memory does not cross vacancy ids',async()=>{await M.remember({semanticKey:'WHY_COMPANY:100:x',normalizedQuestion:'why',answer:'A',source:'user',confidence:1,userConfirmed:true,category:'WHY_COMPANY',vacancyKey:'100'});assert.equal(await M.get('WHY_COMPANY:100:x',{vacancyKey:'200',vacancySpecific:true}),null);});
