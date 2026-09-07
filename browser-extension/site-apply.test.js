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

assert.equal(apply.isHhUrl('https://hh.ru/vacancy/123'), true);
assert.equal(apply.isHhUrl('https://spb.hh.ru/vacancy/123'), true);
assert.equal(apply.isHhUrl('https://career.habr.com/vacancies/123'), false);

let hhResume = apply.chooseHhResumeChoice([
  { label: 'Java Developer', metadata: { selected: false } },
  { label: 'Junior Fullstack Developer', metadata: { selected: true } }
]);
assert.equal(hhResume.found, true);
assert.equal(hhResume.candidate.label, 'Junior Fullstack Developer');
assert.equal(hhResume.reason, 'already-selected');

hhResume = apply.chooseHhResumeChoice([
  { label: 'Junior Fullstack Developer', metadata: { selected: false } }
]);
assert.equal(hhResume.found, true);
assert.equal(hhResume.reason, 'single-resume');

hhResume = apply.chooseHhResumeChoice([
  { label: 'Backend Java Engineer', metadata: { selected: false } },
  { label: 'Junior Fullstack Developer', metadata: { selected: false } }
], 'Junior Fullstack Developer.pdf');
assert.equal(hhResume.found, true);
assert.equal(hhResume.candidate.label, 'Junior Fullstack Developer');
assert.equal(hhResume.reason, 'preferred-match');

hhResume = apply.chooseHhResumeChoice([
  { label: 'Backend Java Engineer', metadata: { selected: false } },
  { label: 'QA Engineer', metadata: { selected: false } }
]);
assert.equal(hhResume.found, false);
assert.equal(hhResume.ambiguous, true);
assert.equal(hhResume.reason, 'resume-choice-required');

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

assert.equal(apply.unresolvedRequired([
  { required: true, type: 'radio', group: 'authorization', checked: false },
  { required: true, type: 'radio', group: 'authorization', checked: true },
  { required: true, type: 'text', value: '', hidden: true }
]).length, 0, 'a checked radio satisfies its required group and hidden future-step fields do not block the current step');

const ready = { applicationUiFound: true, unresolvedRequired: 0, cvFieldPresent: true, cvUploaded: true, finalFound: true };
assert.deepEqual(apply.canSubmit(ready), { ok: true, reason: 'ready' });
assert.equal(apply.canSubmit({ ...ready, applicationUiFound: false }).reason, 'application-ui-not-found');
assert.equal(apply.canSubmit({ ...ready, unresolvedRequired: 1 }).reason, 'required-fields');
assert.equal(apply.canSubmit({ ...ready, cvUploaded: false }).reason, 'cv-not-uploaded');
assert.equal(apply.canSubmit({ ...ready, coverLetterRequired: true, coverLetterFilled: false }).reason, 'cover-letter-not-persisted');
assert.deepEqual(apply.canSubmit({ ...ready, coverLetterRequired: true, coverLetterFilled: true }), { ok: true, reason: 'ready' });

assert.equal(apply.canAcceptReceipt({ finalClicked: false, receiptConfirmed: true }), false,
  'confirmation-looking vacancy copy cannot be recorded before a final action');
assert.equal(apply.canAcceptReceipt({ finalClicked: true, receiptConfirmed: true }), true);

const smartSource = 'https://jobs.smartrecruiters.com/SoftwareMind/744000146148409--rtc-intern-ai-driven-software-engineer';
const smartForm = 'https://jobs.smartrecruiters.com/oneclick-ui/company/SoftwareMind/publication/74820555-f582-4a4b-94b0-7d183a71175a?dcr_ci=SoftwareMind';
const matchingPage = '[RTC] Intern AI-Driven Software Engineer Personal information Resume';
assert.equal(apply.canResume({ sourceUrl: smartSource, currentUrl: smartForm, jobTitle: '[RTC] Intern AI-Driven Software Engineer', pageText: matchingPage }).ok, true);
assert.equal(apply.canResume({ sourceUrl: smartSource, currentUrl: smartForm.replace('/SoftwareMind/', '/OtherCompany/'), jobTitle: '[RTC] Intern AI-Driven Software Engineer', pageText: matchingPage }).reason, 'different-ats-tenant');
assert.equal(apply.canResume({ sourceUrl: smartSource, currentUrl: smartForm, jobTitle: '[RTC] Intern AI-Driven Software Engineer', pageText: 'Senior Java Engineer application' }).reason, 'different-job');
console.log('site-apply tests passed');
