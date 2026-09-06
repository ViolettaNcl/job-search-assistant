const assert = require("node:assert/strict");
const sessions = require("./application-session.js");

const now = 1_800_000_000_000;
const latest = { match: { score: 91 }, draft: { coverLetter: "Hello", recommendedCv: "English.pdf" } };
const page = {
  url: "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Berlin/Junior-Developer_R123",
  title: "Junior Developer",
  company: "Acme",
  ats: "workday"
};

const session = sessions.create({ latest, latestPage: page, latestTrackedId: "job-1", coverLetter: "Edited letter" }, now);
assert.ok(session);
assert.equal(session.version, 1);
assert.equal(session.coverLetter, "Edited letter");
assert.equal(session.latestTrackedId, "job-1");
assert.equal(sessions.slotKey(42), "vjaApplicationSession:42");
assert.equal(sessions.slotKey("bad"), "");

assert.equal(sessions.canRestore(session, page.url, now + 1_000), true);
assert.equal(
  sessions.canRestore(session, "https://acme.wd5.myworkdayjobs.com/en-US/Careers/apply/job/R123/application", now + 5_000),
  true
);
assert.equal(
  sessions.canRestore(session, "https://acme.wd3.myworkdayjobs.com/en-US/Jobs/apply/job/R123", now + 5_000),
  true
);
assert.equal(
  sessions.canRestore(session, "https://other.wd3.myworkdayjobs.com/en-US/Jobs/apply/job/R123", now + 5_000),
  false
);
assert.equal(
  sessions.canRestore(session, "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Berlin/Other-Role_R999", now + 5_000),
  false
);
assert.equal(
  sessions.canRestore(session, "https://example.com/application", now + 5_000),
  false
);
assert.equal(
  sessions.canRestore(session, page.url, now + sessions.DEFAULT_TTL_MS + 1),
  false
);

assert.equal(sessions.isApplicationLike("https://jobs.smartrecruiters.com/acme/123/apply"), true);
assert.equal(sessions.isApplicationLike("https://jobs.smartrecruiters.com/acme/123"), false);
assert.equal(sessions.hostFamily("https://foo.jobs.smartrecruiters.com/apply"), "smartrecruiters.com");
assert.equal(sessions.tenantKey("https://acme.wd5.myworkdayjobs.com/apply"), "workday:acme");
assert.equal(sessions.tenantKey("https://other.wd3.myworkdayjobs.com/apply"), "workday:other");
assert.equal(sessions.normalizedUrl("https://example.com/job/123/#details"), "https://example.com/job/123");

assert.equal(sessions.create({ latest: null, latestPage: page }, now), null);
assert.equal(sessions.canRestore(null, page.url, now), false);

console.log("application-session tests passed");