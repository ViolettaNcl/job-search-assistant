const assert = require("assert");
const profile = require("./candidate-local-profile.js");

assert.equal(profile.validatePhone("+357 99 123 456"), "");
assert.match(profile.validatePhone("123"), /7 and 15 digits/);
assert.match(profile.validatePhone("call me maybe"), /digits/);

assert.equal(
  profile.normalizeLinkedIn("www.linkedin.com/in/example-person"),
  "https://www.linkedin.com/in/example-person"
);
assert.equal(profile.validateLinkedIn("linkedin.com/in/example-person"), "");
assert.match(profile.validateLinkedIn("https://example.com/in/example-person"), /linkedin\.com/);
assert.match(profile.validateLinkedIn("https://www.linkedin.com/"), /profile URL/);

const memory = profile.applyToMemory(
  { "custom:preferred editor": "Rider", phone: "old" },
  { phone: "+357 99 123 456", linkedin: "linkedin.com/in/example-person" }
);
assert.equal(memory.phone, "+357 99 123 456");
assert.equal(memory.linkedin, "https://linkedin.com/in/example-person");
assert.equal(memory["custom:preferred editor"], "Rider", "unrelated remembered answers must survive contact updates");

const cleared = profile.applyToMemory(memory, { phone: "", linkedin: "" });
assert.equal(cleared.phone, undefined);
assert.equal(cleared.linkedin, undefined);
assert.equal(cleared["custom:preferred editor"], "Rider");

const localOnly = profile.resolve({ candidate: {}, memory });
assert.equal(localOnly.phoneReady, true);
assert.equal(localOnly.linkedinReady, true);
assert.equal(localOnly.phoneSource, "local");
assert.equal(localOnly.linkedinSource, "local");

const verifiedWins = profile.resolve({
  candidate: { phone: "+7 900 000 00 00", linkedInUrl: "https://www.linkedin.com/in/verified-person" },
  memory
});
assert.equal(verifiedWins.phone, "+7 900 000 00 00");
assert.equal(verifiedWins.linkedin, "https://www.linkedin.com/in/verified-person");
assert.equal(verifiedWins.phoneSource, "backend");
assert.equal(verifiedWins.linkedinSource, "backend");

const partial = profile.resolve({ candidate: {}, memory: { phone: "+357 99 123 456" } });
assert.equal(partial.phoneReady, true);
assert.equal(partial.linkedinReady, false);
assert.match(profile.summary(partial), /LinkedIn/);

console.log("candidate-local-profile tests passed");
