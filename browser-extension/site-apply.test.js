const assert = require('assert');
const apply = require('./site-apply.js');

let start = apply.chooseStartAction([
  { label: 'Сохранить', metadata: {} },
  { label: 'Откликнуться', metadata: { href: '/vacancies/100/respond' } }
]);
assert.equal(start.found, true);
assert.equal(start.candidate.label, 'Откликнуться');

start = apply.chooseStartAction([
  { label: 'Apply now', metadata: { href: '/apply' } },
  { label: 'Sign in', metadata: {} }
]);
assert.equal(start.found, true);
assert.equal(start.candidate.label, 'Apply now');

const letter = apply.chooseCoverLetterField([
  { label: 'Expected salary', metadata: { textarea: false } },
  { label: 'Сопроводительное письмо', metadata: { textarea: true } }
]);
assert.equal(letter.found, true);
assert.equal(letter.candidate.label, 'Сопроводительное письмо');

assert.equal(apply.unresolvedRequired([
  { required: true, type: 'text', value: '' },
  { required: true, type: 'file', fileCount: 1 },
  { required: false, type: 'text', value: '' }
]).length, 1);

assert.deepEqual(apply.canSubmit({ unresolvedRequired: 0, cvFieldPresent: true, cvUploaded: true, finalFound: true }), { ok: true, reason: 'ready' });
assert.equal(apply.canSubmit({ unresolvedRequired: 1, cvFieldPresent: true, cvUploaded: true, finalFound: true }).reason, 'required-fields');
assert.equal(apply.canSubmit({ unresolvedRequired: 0, cvFieldPresent: true, cvUploaded: false, finalFound: true }).reason, 'cv-not-uploaded');
console.log('site-apply tests passed');
