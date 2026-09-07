const assert = require("assert");
const readiness = require("./setup-readiness.js");

const allReady = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: true, linkedin: false },
  cv: { english: true, russian: true }, queue: { strongCount: 4 }, hh: { authorized: false, resumeSelected: false }
});
assert.equal(allReady.state, "ready", "LinkedIn and HH API OAuth are not required for website applications");
assert.equal(allReady.capabilities.externalAts, true);
assert.equal(allReady.capabilities.contactAutofill, true);
assert.equal(allReady.capabilities.hhDirect, false);
assert.doesNotMatch(allReady.items.find(x => x.id === "contacts").detail, /LinkedIn/i);

const phoneMissing = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: false },
  cv: { english: true, russian: true }, queue: { strongCount: 3 }, hh: { authorized: false, resumeSelected: false }
});
assert.equal(phoneMissing.state, "attention");
assert.equal(phoneMissing.capabilities.externalAts, true);
assert.equal(phoneMissing.capabilities.contactAutofill, false);
assert.match(phoneMissing.items.find(x => x.id === "contacts").detail, /phone/i);

const cvMissing = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: true },
  cv: { english: true, russian: false }, queue: { strongCount: 3 }, hh: { authorized: false, resumeSelected: false }
});
assert.equal(cvMissing.state, "attention");
assert.equal(cvMissing.capabilities.cvAutoload, false);

const queueEmpty = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: true },
  cv: { english: true, russian: true }, queue: { strongCount: 0 }, hh: { authorized: false, resumeSelected: false }
});
assert.equal(queueEmpty.state, "attention");
assert.equal(queueEmpty.capabilities.dailyQueue, false);

const backendDown = readiness.build({
  backend: { reachable: false, ready: false }, candidate: { coreReady: true }, contacts: { phone: true },
  cv: { english: true, russian: true }, queue: { strongCount: 5 }, hh: { authorized: false, resumeSelected: false }
});
assert.equal(backendDown.state, "blocked");
assert.equal(backendDown.capabilities.externalAts, false);

const candidateIncomplete = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: false }, contacts: { phone: true },
  cv: { english: true, russian: true }, queue: { strongCount: 5 }, hh: { authorized: false, resumeSelected: false }
});
assert.equal(candidateIncomplete.state, "blocked");

console.log("setup-readiness tests passed");
