const assert = require("assert");
const continuation = require("./application-continuation.js");

const beforeRecord = continuation.build({ recorded: false, nextJob: { url: "https://example.com/job" } });
assert.equal(beforeRecord.visible, false);
assert.equal(beforeRecord.enabled, false);

const none = continuation.build({ recorded: true, nextJob: null });
assert.equal(none.visible, true);
assert.equal(none.enabled, false);
assert.match(none.label, /No next 75\+ job/);

const next = continuation.build({
  recorded: true,
  nextJob: {
    url: "https://jobs.example.com/roles/123",
    title: "Junior .NET Developer",
    company: "Example Systems",
    matchScore: 88.4
  }
});
assert.equal(next.visible, true);
assert.equal(next.enabled, true);
assert.equal(next.url, "https://jobs.example.com/roles/123");
assert.equal(next.label, "Continue to next 88/100 job");
assert.match(next.detail, /Junior \.NET Developer/);
assert.match(next.detail, /Example Systems/);
assert.match(next.detail, /88\/100/);

const unsafe = continuation.build({
  recorded: true,
  nextJob: { url: "javascript:alert(1)", title: "Unsafe" }
});
assert.equal(unsafe.enabled, false, "non-http(s) navigation must never be offered");
assert.equal(unsafe.url, "");

assert.equal(continuation.boundedScore(120), 100);
assert.equal(continuation.boundedScore(-3), 0);
assert.equal(continuation.boundedScore("76.6"), 77);
assert.equal(continuation.safeWebUrl("ftp://example.com/job"), "");
assert.match(continuation.shorten("x".repeat(100), 12), /…$/);

console.log("application-continuation tests passed");
