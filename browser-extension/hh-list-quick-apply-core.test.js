const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('./hh-list-quick-apply-core.js');

test('recognizes supported HeadHunter family hosts',()=>{
  assert.equal(H.isSupportedHost('https://hh.ru/search/vacancy'),true);
  assert.equal(H.isSupportedHost('https://spb.hh.ru/vacancy/123'),true);
  assert.equal(H.isSupportedHost('https://headhunter.kg/vacancy/123'),true);
  assert.equal(H.isSupportedHost('https://bishkek.headhunter.kg/search/vacancy'),true);
  assert.equal(H.isSupportedHost('https://example.com/vacancy/123'),false);
});

test('recognizes only intentional HH list apply labels',()=>{
  assert.equal(H.isApplyLabel('Откликнуться'),true);
  assert.equal(H.isApplyLabel('Быстрый отклик'),true);
  assert.equal(H.isApplyLabel('Приложить письмо'),false);
});

test('recognizes post-apply cover-letter action',()=>{
  assert.equal(H.isLetterActionLabel('Приложить письмо'),true);
  assert.equal(H.isLetterActionLabel('Приложить сопроводительное письмо'),true);
  assert.equal(H.isLetterActionLabel('Добавить письмо'),true);
});

test('recognizes both HH cover-letter submit patterns',()=>{
  assert.equal(H.isInitialSubmitLabel('Откликнуться'),true);
  assert.equal(H.isInitialSubmitLabel('Отправить отклик'),true);
  assert.equal(H.isInitialSubmitLabel('Подать заявку'),true);
  assert.equal(H.isSendLetterLabel('Отправить'),true);
});

test('chooses one modal submit candidate only',()=>{
  const one=H.chooseInitialSubmitCandidate([{label:'Закрыть',visible:true},{label:'Откликнуться',visible:true}]);
  assert.equal(one.found,true);assert.equal(one.candidate.label,'Откликнуться');
  const many=H.chooseInitialSubmitCandidate([{label:'Откликнуться',visible:true},{label:'Откликнуться',visible:true}]);
  assert.equal(many.found,false);assert.equal(many.ambiguous,true);
});

test('rejects search-page headings as vacancy titles',()=>{
  assert.equal(H.isSuspiciousVacancyTitle('Найдено 19 718 вакансий'),true);
  assert.equal(H.isSuspiciousVacancyTitle('Поиск вакансий'),true);
  assert.equal(H.isSuspiciousVacancyTitle('Менеджер по работе с клиентами в чатах'),false);
});
