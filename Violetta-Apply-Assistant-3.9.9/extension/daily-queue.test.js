const assert = require("node:assert/strict");
const queue = require("./daily-queue.js");

const jobs = [
  { vacancyId: "1", title: "Current", company: "A", matchScore: 96, eligibilityStatus: "Eligible", url: "https://jobs.example.com/1#top" },
  { vacancyId: "2", title: "Blocked", company: "B", matchScore: 94, eligibilityStatus: "Likely ineligible", url: "https://jobs.example.com/2" },
  { vacancyId: "3", title: "Strong", company: "C", matchScore: 91, eligibilityStatus: "Eligible", url: "https://jobs.example.com/3/" },
  { vacancyId: "4", title: "Low", company: "D", matchScore: 70, eligibilityStatus: "Eligible", url: "https://jobs.example.com/4" }
];

assert.equal(queue.normalizeUrl("javascript:alert(1)"), "");
assert.equal(queue.normalizeUrl("https://jobs.example.com/3/#x"), "https://jobs.example.com/3");
assert.equal(queue.isLikelyIneligible("Likely ineligible"), true);
assert.equal(queue.isLikelyIneligible("Eligible"), false);

const next = queue.selectNext(jobs, {
  minScore: 75,
  excludeUrls: ["https://jobs.example.com/1"]
});
assert.ok(next);
assert.equal(next.vacancyId, "3");
assert.equal(next.url, "https://jobs.example.com/3");

assert.equal(queue.selectNext(jobs, { minScore: 95, excludeUrls: ["https://jobs.example.com/1"] }), null);
assert.equal(queue.selectNext([{ matchScore: 99, eligibilityStatus: "Eligible", url: "file:///tmp/job" }]), null);
assert.match(queue.summary(next), /Strong/);
assert.match(queue.summary(next), /91\/100/);
assert.match(queue.summary(null), /No strong unapplied jobs/);

console.log("daily-queue tests passed");