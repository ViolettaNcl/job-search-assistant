const assert=require('node:assert/strict');
const F=require('./followup-intelligence.js');
const base=new Date(2026,8,23,12,0,0,0); // local test date: Wed 23 Sep 2026

let x=F.extract('Спасибо за отклик. Мы рассмотрим резюме и вернёмся с обратной связью через 2-3 дня.',base.getTime());
assert.equal(x.type,'feedback');
assert.equal(new Date(x.dueAt).getDate(),26);

x=F.extract('Мы дадим обратную связь до пятницы.',base.getTime());
assert.equal(x.type,'feedback');
assert.equal(new Date(x.dueAt).getDay(),5);
assert.equal(new Date(x.dueAt).getDate(),25);

x=F.extract('Интервью назначим на завтра, время пришлём отдельно.',base.getTime());
assert.equal(x.type,'interview');
assert.equal(new Date(x.dueAt).getDate(),24);

x=F.extract('Тестовое задание нужно прислать до 28.09.2026.',base.getTime());
assert.equal(x.type,'test-deadline');
assert.equal(new Date(x.dueAt).getDate(),28);

x=F.extract('We will get back to you within 3 business days.',base.getTime());
assert.equal(x.type,'feedback');
assert.equal(new Date(x.dueAt).getDay(),1); // Mon 28 Sep (Thu, Fri, Mon)
assert.equal(new Date(x.dueAt).getDate(),28);

assert.equal(F.extract('Спасибо, резюме получили.',base.getTime()),null,'no invented deadline without explicit date/window');
const action={type:'feedback',dueAt:base.getTime()-1000,label:'Follow up',sourceText:'x',createdAt:base.getTime()-10000};
assert.equal(F.isDue(action,base.getTime()),true);
assert.equal(F.dueItems([{status:'Applied',nextAction:action},{status:'Rejected',nextAction:action}],base.getTime()).length,1);
const snoozed=F.snooze(action,1,base.getTime());assert(snoozed.dueAt>base.getTime());
console.log('followup-intelligence tests passed');
