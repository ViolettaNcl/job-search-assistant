'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const H=require('./hh-list-quick-apply-core.js');
test('recognizes only intentional HH list apply labels',()=>{assert.equal(H.isApplyLabel('Откликнуться'),true);assert.equal(H.isApplyLabel('Быстрый отклик'),true);assert.equal(H.isApplyLabel('Приложить письмо'),false);});
test('recognizes HH post-apply cover-letter action',()=>{assert.equal(H.isLetterActionLabel('Приложить письмо'),true);assert.equal(H.isLetterActionLabel('Приложить сопроводительное письмо'),true);assert.equal(H.isLetterActionLabel('Связаться'),false);});
test('vacancy identity comes from vacancy URL',()=>{assert.equal(H.vacancyIdFromUrl('https://hh.ru/vacancy/130452758?from=search'),'130452758');assert.equal(H.sameVacancyUrl('https://hh.ru/vacancy/1','https://spb.hh.ru/vacancy/1?x=1'),true);assert.equal(H.sameVacancyUrl('https://hh.ru/vacancy/1','https://hh.ru/vacancy/2'),false);});
test('letter modal requires one unambiguous Send button',()=>{assert.equal(H.chooseSendCandidate([{label:'Закрыть'},{label:'Отправить'}]).found,true);assert.equal(H.chooseSendCandidate([{label:'Отправить'},{label:'Отправить'}]).ambiguous,true);});
test('applied receipt labels are recognized',()=>{assert.equal(H.isAppliedText('Вы откликнулись'),true);assert.equal(H.isAppliedText('Ваш отклик отправлен работодателю'),true);});
