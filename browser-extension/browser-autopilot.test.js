const assert = require('assert');
const autopilot = require('./browser-autopilot.js');

assert.equal(autopilot.isHhVacancy('https://hh.ru/vacancy/123'), true);
assert.equal(autopilot.isHhVacancy('https://spb.hh.ru/vacancy/123?from=search'), true);
assert.equal(autopilot.isHhVacancy('https://linkedin.com/jobs/123'), false);

assert.equal(autopilot.shouldRun({ autoApplyEnabled: true, allowed: true, remainingToday: 5, automationMode: 'browser-extension' }), true);
assert.equal(autopilot.shouldRun({ autoApplyEnabled: true, allowed: true, remainingToday: 5, automationMode: 'hh-api', apiReady: true }), false);
assert.equal(autopilot.shouldRun({ autoApplyEnabled: false, allowed: true, remainingToday: 5 }), false);
assert.equal(autopilot.hasSafeSeniority('Senior .NET Developer'), false);
assert.equal(autopilot.hasSafeSeniority('Junior .NET Developer'), true);

const candidate = autopilot.selectCandidate([
  { vacancyId: 'bad', url: 'https://linkedin.com/jobs/1', matchScore: 99, eligibilityStatus: 'Eligible' },
  { vacancyId: 'unknown', url: 'https://hh.ru/vacancy/5', matchScore: 98, eligibilityStatus: 'Needs verification', title: 'Junior .NET' },
  { vacancyId: 'senior', url: 'https://hh.ru/vacancy/6', matchScore: 97, eligibilityStatus: 'Eligible', title: 'Senior .NET Developer' },
  { vacancyId: 'low', url: 'https://hh.ru/vacancy/2', matchScore: 70, eligibilityStatus: 'Eligible' },
  { vacancyId: 'good', url: 'https://hh.ru/vacancy/3', matchScore: 86, eligibilityStatus: 'Eligible', title: 'Junior .NET' }
], 75);
assert.equal(candidate.vacancyId, 'good');

const plan = autopilot.buildPlan(candidate, { coverLetter: 'Vacancy-specific letter', recommendedCv: 'CV RU' }, 1000);
assert.equal(plan.trackedId, 'good');
assert.equal(plan.coverLetter, 'Vacancy-specific letter');
assert.equal(plan.siteKind, 'hh');
assert.equal(plan.automatic, true);

console.log('browser-autopilot tests passed');
