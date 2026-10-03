const test=require('node:test');const assert=require('node:assert/strict');const A=require('./site-adapter-core.js');
test('adapter contract rejects incomplete adapters',()=>{const r=A.validate({detectPage(){}});assert.equal(r.ok,false);assert.ok(r.missing.includes('extractVacancy'));});
test('registry accepts a full adapter contract',()=>{const fn=()=>null,obj=Object.fromEntries(A.required.map(k=>[k,fn])),r=A.registry();r.register('hh',obj);assert.deepEqual(r.names(),['hh']);});
