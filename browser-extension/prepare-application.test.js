const assert = require("node:assert/strict");
const prep = require("./prepare-application.js");

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

console.log("prepare-application tests passed");