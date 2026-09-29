const assert = require("node:assert/strict");
const prep = require("./prepare-application.js");
const sessions = require("./application-session.js");
const siteApply = require("./site-apply.js");

let result = prep.summarize({
  analyzed: true,
  detectedFields: 6,
  filled: 6,
  failed: 0,
  review: 0,
  blocked: 0,
  cv: "uploaded"
});
assert.equal(result.state, "prepared");
assert.equal(prep.buttonLabel(result.state), "Prepared ✓");
assert.match(result.message, /6 safe fields verified/);

result = prep.summarize({
  analyzed: true,
  detectedFields: 7,
  filled: 3,
  review: 2,
  blocked: 1,
  failed: 1,
  cv: "no-field"
});
assert.equal(result.state, "needs-review");
assert.match(result.message, /2 fields need review/);
assert.match(result.message, /manual-only/);

result = prep.summarize({
  analyzed: true,
  detectedFields: 3,
  filled: 3,
  cv: "no-field"
});
assert.equal(result.state, "prepared");
assert.match(result.message, /no CV upload field detected on this stage/);

result = prep.summarize({ analyzed: true, detectedFields: 0, cv: "not-attempted" });
assert.equal(result.state, "analysis-only");
assert.equal(prep.buttonLabel(result.state), "Tailored — open application form");

result = prep.summarize({ analyzed: false });
assert.equal(result.state, "failed");

result = prep.summarize({
  analyzed: true,
  detectedFields: 2,
  filled: 2,
  cv: "missing",
  hh: true
});
assert.equal(result.state, "needs-review");
assert.match(result.message, /HH submission remains a separate confirmed action/);
assert.match(result.message, /not stored/);

result = prep.summarize({ analyzed: true, detectedFields: 0, hh: true });
assert.equal(result.state, "prepared");
assert.match(result.message, /HH application draft is ready/);
assert.match(result.message, /separate confirmed action/);

const cached = {
  latest: { match: { score: 82 }, draft: { coverLetter: "Tailored" } },
  latestPage: { url: "https://hh.ru/vacancy/130452758", title: "Программист .Net" },
  currentUrl: "https://hh.ru/vacancy/130452758?from=search",
  sessionApi: sessions,
  siteApplyApi: siteApply,
  now: 1_800_000_000_000
};
assert.equal(prep.canReuseAnalysis(cached), true, "same vacancy reuses its existing tailored analysis");
assert.equal(prep.canReuseAnalysis({ ...cached, currentUrl: "https://hh.ru/vacancy/137044225" }), false,
  "a different vacancy always gets a fresh analysis");
assert.equal(prep.canReuseAnalysis({ ...cached, latest: null }), false);

console.log("prepare-application tests passed");
