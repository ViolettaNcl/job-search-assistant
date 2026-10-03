const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('./questionnaire-core.js');

test('classifies projects question',()=>assert.equal(Q.classify('Есть ли у вас опыт работы с проектами? Если да, с какими проектами работали?',{type:'textarea'}),'PROJECTS'));
test('classifies English level question',()=>assert.equal(Q.classify('Какой у вас уровень английского? Как часто применяли его в работе?',{type:'textarea'}),'ENGLISH_LEVEL'));
test('classifies salary as a decision field',()=>{const c=Q.classify('Какие условия по зарплате рассматриваете? Напишите вилку',{type:'textarea'});assert.equal(c,'SALARY');assert.equal(Q.isDecisionCategory(c),true);});
test('classifies legal consent safely',()=>assert.equal(Q.classify('Я согласен на обработку персональных данных',{type:'checkbox'}),'CONSENT'));
test('vacancy-specific questions get vacancy-specific semantic keys',()=>assert.notEqual(Q.semanticKey('WHY_COMPANY','Почему наша компания?','100'),Q.semanticKey('WHY_COMPANY','Почему наша компания?','200')));
test('generic English memory key is stable across vacancies',()=>assert.equal(Q.semanticKey('ENGLISH_LEVEL','Уровень английского?','100'),Q.semanticKey('ENGLISH_LEVEL','Какой у вас уровень английского?','200')));

test('suggested state is visibly marked as a draft',()=>assert.match(Q.stateLabel('suggested'),/Черновик/));
