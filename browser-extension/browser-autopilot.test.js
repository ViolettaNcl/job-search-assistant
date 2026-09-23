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
assert.equal(autopilot.isProgrammingRole('Junior C# Developer'), true);
assert.equal(autopilot.isProgrammingRole('Technical Support Specialist'), true);
assert.equal(autopilot.isProgrammingRole('Manual QA Engineer'), true);
assert.equal(autopilot.hasSafeSeniority('Middle .NET Developer'), false);

const candidate = autopilot.selectCandidate([
  { vacancyId: 'bad', url: 'https://linkedin.com/jobs/1', matchScore: 99, title:'Junior C#' },
  { vacancyId: 'support', url: 'https://hh.ru/vacancy/4', matchScore: 99, title:'Technical Support Specialist', remote:true },
  { vacancyId: 'senior', url: 'https://hh.ru/vacancy/6', matchScore: 97, title: 'Senior .NET Developer' },
  { vacancyId: 'office', url: 'https://hh.ru/vacancy/7', matchScore: 96, title:'Junior C# Developer', remote:false },
  { vacancyId: 'low', url: 'https://hh.ru/vacancy/2', matchScore: 70, title:'Junior C# Developer', remote:true },
  { vacancyId: 'good', url: 'https://hh.ru/vacancy/3', matchScore: 86, title: 'Junior .NET Developer', remote:true }
], 75, {programmingOnly:true,remoteOnly:true});
assert.equal(candidate.vacancyId, 'support');
for (const eligibilityStatus of ['Eligible','Verify','Likely ineligible']) {
  assert(autopilot.selectCandidate([{url:'https://hh.ru/vacancy/1',title:'Junior C#',matchScore:90,eligibilityStatus,remote:true}],75));
}
for (const job of [
  {url:'http://hh.ru/vacancy/1',title:'Junior C#',matchScore:90,remote:true},
  {url:'https://hh.ru/vacancy/1',title:'Senior C#',matchScore:90,remote:true},
  {url:'https://hh.ru/vacancy/1',title:'Junior C#',matchScore:70,remote:true},
  {url:'https://hh.ru/vacancy/1',title:'Customer Support',matchScore:95,remote:true},
  {url:'https://hh.ru/vacancy/1',title:'Middle .NET Developer',matchScore:95,remote:true},
  {url:'https://hh.ru/vacancy/1',title:'Junior C#',matchScore:95,remote:false}
]) assert.equal(autopilot.selectCandidate([job],75),null);

const prefs=autopilot.normalizePreferences({sessionLimit:999,searchQueries:['  Junior .NET  ','']});
assert.equal(prefs.sessionLimit,20);assert.deepEqual(prefs.searchQueries,['Junior .NET']);
const plan = autopilot.buildPlan(candidate, { coverLetter: 'Vacancy-specific letter', recommendedCv: 'CV RU' }, 1000);
assert.equal(plan.trackedId, 'support');
assert.equal(plan.coverLetter, 'Vacancy-specific letter');
assert.equal(plan.siteKind, 'hh');
assert.equal(plan.automatic, true);
assert.equal(plan.letterVersion,'3.7-context-github');
console.log('browser-autopilot tests passed');
