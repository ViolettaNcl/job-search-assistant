const assert = require("assert");
const profile = require("./candidate-local-profile.js");

assert.equal(profile.validatePhone("+357 99 123 456"), "");
assert.match(profile.validatePhone("123"), /7 and 15 digits/);
assert.match(profile.validatePhone("call me maybe"), /digits/);

// Legacy LinkedIn helpers remain valid so an old browser profile can be migrated safely.
assert.equal(profile.normalizeLinkedIn("www.linkedin.com/in/example-person"), "https://www.linkedin.com/in/example-person");
assert.equal(profile.validateLinkedIn("linkedin.com/in/example-person"), "");

const memory = profile.applyToMemory({ "custom:preferred editor": "Rider", phone: "old" }, { phone: "+357 99 123 456", linkedin: "" });
assert.equal(memory.phone, "+357 99 123 456");
assert.equal(memory.linkedin, undefined);
assert.equal(memory["custom:preferred editor"], "Rider");

const localOnly = profile.resolve({ candidate: {}, memory });
assert.equal(localOnly.phoneReady, true);
assert.equal(localOnly.contactReady, true);
assert.equal(localOnly.bothReady, true, "phone alone is the reusable-contact readiness requirement");
assert.equal(localOnly.phoneSource, "local");
assert.match(profile.summary(localOnly), /Phone is ready/);
assert.doesNotMatch(profile.summary(localOnly), /LinkedIn/i);

const missing = profile.resolve({ candidate: {}, memory: {} });
assert.equal(missing.contactReady, false);
assert.match(profile.summary(missing), /phone/i);
assert.doesNotMatch(profile.summary(missing), /LinkedIn/i);

console.log("candidate-local-profile tests passed");
