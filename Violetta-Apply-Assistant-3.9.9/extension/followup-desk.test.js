const assert = require("node:assert/strict");
const desk = require("./followup-desk.js");

const id1 = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";

assert.equal(desk.safeHttpUrl("javascript:alert(1)"), "");
assert.equal(desk.safeHttpUrl("not a url"), "");
assert.match(desk.safeHttpUrl("https://jobs.example.com/a"), /^https:\/\//);

assert.equal(desk.normalizeItem({ vacancyId: "bad" }), null);
const normalized = desk.normalizeItem({
  vacancyId: id1,
  title: "  Junior   Developer ",
  company: "Acme",
  url: "https://jobs.example.com/123",
  matchScore: 109,
  businessDaysWaiting: 7,
  followUpCount: 1,
  priorityScore: 93,
  language: "ru",
  message: "Здравствуйте!"
});
assert.equal(normalized.title, "Junior Developer");
assert.equal(normalized.matchScore, 100);
assert.equal(normalized.language, "ru");
assert.equal(desk.attemptNumber(normalized), 2);

const malformed = desk.normalizeItem({
  vacancyId: id2,
  matchScore: "not-a-number",
  businessDaysWaiting: null,
  followUpCount: "bad",
  priorityScore: undefined
});
assert.equal(malformed.matchScore, 0);
assert.equal(malformed.businessDaysWaiting, 0);
assert.equal(malformed.followUpCount, 0);
assert.equal(malformed.priorityScore, 0);
assert.equal(desk.attemptNumber({ followUpCount: "bad" }), 1);

const next = desk.selectNext([
  { vacancyId: id1, title: "A", priorityScore: 90, businessDaysWaiting: 8, matchScore: 88 },
  { vacancyId: id2, title: "B", priorityScore: 96, businessDaysWaiting: 5, matchScore: 92 }
]);
assert.equal(next.vacancyId, id2);
assert.equal(desk.selectNext([]), null);

const request = desk.buildMarkSentRequest(id1, "Sent manually after recruiter message");
assert.equal(request.path, `/api/vacancies/${id1}/followup-sent`);
assert.equal(request.method, "POST");
assert.equal(request.body.note, "Sent manually after recruiter message");
assert.equal(desk.buildMarkSentRequest("../../bad"), null);

console.log("followup-desk tests passed");
