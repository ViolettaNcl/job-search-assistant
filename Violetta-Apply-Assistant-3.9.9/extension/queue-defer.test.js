const assert = require("node:assert/strict");
const defer = require("./queue-defer.js");

const now = Date.parse("2026-09-06T15:00:00.000Z");
const request = defer.buildRequest("11111111-2222-3333-4444-555555555555", 4, now);

assert.ok(request);
assert.equal(request.path, "/api/vacancies/11111111-2222-3333-4444-555555555555/status");
assert.equal(request.body.status, "Saved");
assert.equal(request.body.note, "QueueDeferredUntil=2026-09-06T19:00:00.000Z");
assert.equal(request.deferredUntil, "2026-09-06T19:00:00.000Z");
assert.equal(request.hours, 4);
assert.equal(defer.DEFAULT_HOURS, 4);
assert.equal(defer.NOTE_PREFIX, "QueueDeferredUntil=");

assert.equal(defer.buildRequest("", 4, now), null);
assert.equal(defer.buildRequest("job", 0, now), null);
assert.equal(defer.buildRequest("job", 169, now), null);
assert.equal(defer.buildRequest("job", 4, Number.NaN), null);

console.log("queue-defer tests passed");