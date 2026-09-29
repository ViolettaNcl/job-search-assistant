const assert = require('node:assert/strict');
const chat = require('./recruiter-chat.js');

assert.equal(chat.detectRoleFamily({ title: 'Специалист письменной технической поддержки' }), 'support');
assert.equal(chat.detectRoleFamily({ title: 'Junior .NET Developer' }), 'developer');
assert.equal(chat.detectRoleFamily({ title: 'Контент-модератор' }), 'content');
assert.equal(chat.detectRoleFamily({ title: 'Operations Coordinator' }), 'operations');

const built = chat.buildTriageText({
  url: 'https://example.com/messages/1',
  vacancy: { title: 'Customer Support Specialist', company: 'Acme', description: 'Written support for customers.' },
  messages: [
    { speaker: 'employer', text: 'Здравствуйте! Расскажите о вашем опыте общения с клиентами.' },
    { speaker: 'candidate', text: 'Здравствуйте!' }
  ],
  latestInbound: 'Здравствуйте! Расскажите о вашем опыте общения с клиентами.'
});
assert.match(built, /VACANCY CONTEXT/);
assert.match(built, /Customer Support Specialist/);
assert.match(built, /Employer:/);

const simplified = chat.simplifyReply(
  'Здравствуйте! У меня нет коммерческого опыта в поддержке. Я работала с C# и ASP.NET Core. Готова обсудить задачи.',
  { family: 'support', language: 'ru', latestInbound: 'Какой у вас опыт поддержки?' }
);
assert.match(simplified, /нет коммерческого опыта/i); // v3 preserves honest limitations
assert.doesNotMatch(simplified, /ASP\.NET|C#/i);
assert.match(simplified, /общаться|задач/i);

const fallback = chat.fallbackReply({
  latestInbound: 'Есть ли у вас опыт письменной поддержки клиентов?',
  vacancy: { title: 'Специалист поддержки' }
}, 'support');
assert.doesNotMatch(fallback, /спокойно общаться|письменной коммуникации/i); // no confirmed source, no claim
assert.doesNotMatch(fallback, /лет опыта/i);

const a = chat.signature({ url: 'x', latestInbound: 'one' });
const b = chat.signature({ url: 'x', latestInbound: 'two' });
assert.notEqual(a, b);
console.log('recruiter-chat tests passed');
