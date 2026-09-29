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

test('builds exact HH API URL for the selected vacancy id',()=>{
  assert.equal(H.hhApiVacancyUrl('https://hh.ru/vacancy/780?from=serp','780'),'https://api.hh.ru/vacancies/780?host=hh.ru');
  assert.equal(H.hhApiVacancyUrl('https://bishkek.headhunter.kg/vacancy/99','99'),'https://api.hh.ru/vacancies/99?host=headhunter.kg');
  assert.equal(H.hhApiVacancyUrl('https://example.com/vacancy/99','99'),'');
});

test('call analysis rejects explicit inbound or outbound phone work',()=>{
  for(const text of ['Принимать входящие звонки клиентов и консультировать по продуктам.','Совершать исходящие звонки по теплой базе.','Voice support and inbound calls for customers.']){
    const r=H.analyzeCallRequirement(text,'full-fetch');
    assert.equal(r.status,'calls',text);assert.equal(r.canApply,false,text);assert.ok(r.evidence,text);
  }
});

test('call analysis allows explicit chat-only and no-call work',()=>{
  for(const text of ['Общение только в чате, без звонков.','Только переписка с клиентами и обработка заявок.','Chat-only customer support, no phone calls.']){
    const r=H.analyzeCallRequirement(text,'full-dom');
    assert.equal(r.status,'no-calls',text);assert.equal(r.canApply,true,text);
  }
});

test('call analysis does not treat generic incoming requests as phone calls',()=>{
  const r=H.analyzeCallRequirement('Обработка входящих обращений клиентов, тикетов и сообщений.','full-fetch');
  assert.equal(r.status,'no-calls');assert.equal(r.hasCalls,false);
});

test('call analysis does not confuse configuring telephony with phone-call duties',()=>{
  const r=H.analyzeCallRequirement('Техническая поддержка сотрудников. Настраивать программы, браузеры, почту, мессенджеры, телефонию, SIP и рабочие устройства. Работа с CRM, API и интеграциями.','full-dom');
  assert.equal(r.status,'no-calls');assert.equal(r.hasCalls,false);
});

test('call analysis rejects generic call duties even without inbound or outbound wording',()=>{
  const r=H.analyzeCallRequirement('В обязанности входят звонки клиентам, консультации и фиксация результата в CRM.','full-dom');
  assert.equal(r.status,'calls');assert.equal(r.canApply,false);assert.ok(r.evidence);
});

test('absence of calls is unknown for a list snippet but green after full description',()=>{
  assert.equal(H.analyzeCallRequirement('Поддержка пользователей в чате.','snippet').status,'unknown');
  assert.equal(H.analyzeCallRequirement('Поддержка пользователей, тикеты и база знаний.','full-fetch').status,'no-calls');
});

test('recognizes HH employer-already-viewed notice without confusing normal submission text',()=>{
  assert.equal(H.isEmployerAlreadyViewedText('Отклик уже просмотрен работодателем.'),true);
  assert.equal(H.isEmployerAlreadyViewedText('Работодатель уже просмотрел ваш отклик'),true);
  assert.equal(H.isEmployerAlreadyViewedText('Ваш отклик отправлен работодателю'),false);
});

test('chooses only an unambiguous Close button for the already-viewed modal',()=>{
  const one=H.chooseCloseCandidate([{label:'Закрыть',visible:true},{label:'Отправить',visible:true}]);
  assert.equal(one.found,true);assert.equal(one.candidate.label,'Закрыть');
  const many=H.chooseCloseCandidate([{label:'Закрыть',visible:true},{label:'Close',visible:true}]);
  assert.equal(many.found,false);assert.equal(many.ambiguous,true);
});
