const assert = require("node:assert/strict");
const sessions = require("./application-session.js");

const now = 1_800_000_000_000;
const latest = {
  match: { score: 92 },
  draft: { coverLetter: "Hello", recommendedCv: "English.pdf" }
};

const workdayPage = {
  url: "https://acme.wd5.myworkdayjobs.com/en-US/Careers/apply/job/R123/application",
  title: "Junior Developer",
  company: "Acme",
  ats: "workday"
};
const workdaySession = sessions.create({ latest, latestPage: workdayPage }, now);
assert.ok(workdaySession);
assert.equal(
  sessions.canRestore(workdaySession, "https://acme.wd5.myworkdayjobs.com/en-US/Careers/application-submitted", now + 5_000),
  true,
  "same Workday tenant confirmation route should retain application context"
);
assert.equal(
  sessions.canRestore(workdaySession, "https://other.wd3.myworkdayjobs.com/en-US/Jobs/application-submitted", now + 5_000),
  false,
  "receipt restoration must not cross Workday tenants"
);

const greenhousePage = {
  url: "https://boards.greenhouse.io/Acme/jobs/123/application",
  title: "Junior Developer",
  company: "Acme",
  ats: "greenhouse"
};
const greenhouseSession = sessions.create({ latest, latestPage: greenhousePage }, now);
assert.equal(
  sessions.canRestore(greenhouseSession, "https://boards.greenhouse.io/Acme/thank-you", now + 5_000),
  true,
  "same shared-ATS tenant thank-you route should restore"
);
assert.equal(
  sessions.canRestore(greenhouseSession, "https://boards.greenhouse.io/Other/thank-you", now + 5_000),
  false,
  "shared ATS confirmation pages must remain tenant-isolated"
);

const genericPage = {
  url: "https://careers.example.com/application/apply/123",
  title: "Junior Developer",
  company: "Example",
  ats: "generic"
};
const genericSession = sessions.create({ latest, latestPage: genericPage }, now);
assert.equal(
  sessions.canRestore(genericSession, "https://careers.example.com/application/confirmation", now + 5_000),
  true,
  "same-origin generic confirmation route should restore"
);
assert.equal(
  sessions.canRestore(genericSession, "https://unrelated.example.net/application/confirmation", now + 5_000),
  false
);

console.log("submission-receipt session tests passed");
