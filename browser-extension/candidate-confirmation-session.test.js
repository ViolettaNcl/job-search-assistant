const assert = require("node:assert/strict");
const sessions = require("./application-session.js");

const now = 1_800_000_000_000;
const page = {
  url: "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Berlin/Junior-Developer_R123",
  title: "Junior Developer",
  company: "Acme",
  ats: "workday"
};
const latest = { match: { score: 91 }, draft: { coverLetter: "Hello" } };
const confirmations = {
  salt: "0123456789abcdef0123456789abcdef",
  records: [{
    fieldHash: "a".repeat(64),
    valueHash: "b".repeat(64),
    at: now,
    answer: "must-not-survive",
    label: "sensitive question"
  }]
};

const session = sessions.create({
  latest,
  latestPage: page,
  candidateConfirmations: confirmations
}, now);

assert.equal(session.candidateConfirmations.salt, confirmations.salt);
assert.equal(session.candidateConfirmations.records.length, 1);
assert.deepEqual(
  Object.keys(session.candidateConfirmations.records[0]).sort(),
  ["at", "fieldHash", "valueHash"]
);
assert.equal(JSON.stringify(session.candidateConfirmations).includes("must-not-survive"), false);
assert.equal(JSON.stringify(session.candidateConfirmations).includes("sensitive question"), false);

const many = {
  salt: confirmations.salt,
  records: Array.from({ length: 120 }, (_, index) => ({
    fieldHash: index.toString(16).padStart(64, "0").slice(-64),
    valueHash: (index + 1).toString(16).padStart(64, "0").slice(-64),
    at: index
  }))
};
assert.equal(
  sessions.sanitizeCandidateConfirmations(many).records.length,
  sessions.MAX_CONFIRMATIONS
);

const invalid = sessions.sanitizeCandidateConfirmations({
  salt: "not-a-salt",
  records: [{ fieldHash: "short", valueHash: "also-short", answer: "secret" }]
});
assert.equal(invalid.salt, "");
assert.deepEqual(invalid.records, []);

console.log("candidate-confirmation session tests passed");
