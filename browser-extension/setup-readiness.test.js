const assert = require("assert");
const readiness = require("./setup-readiness.js");

const allReady = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: true },
  cv: { english: true, russian: true }, queue: { strongCount: 4 }
});
assert.equal(allReady.state, "ready", "LinkedIn and HH API OAuth are not required for website applications");
assert.equal(allReady.capabilities.externalAts, true);
assert.equal(allReady.capabilities.contactAutofill, true);
assert.equal(allReady.capabilities.hhDirect, true, "HH website apply is ready when backend and candidate profile are ready");
assert.equal(allReady.total, 6);
assert.doesNotMatch(allReady.items.find(x => x.id === "contacts").detail, /LinkedIn/i);
assert.equal(allReady.items.some(x => /^hh-/i.test(x.id)), false, "legacy HH OAuth/resume checks are removed");

const phoneMissing = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: false },
  cv: { english: true, russian: true }, queue: { strongCount: 3 }
});
assert.equal(phoneMissing.state, "attention");
assert.equal(phoneMissing.capabilities.externalAts, true);
assert.equal(phoneMissing.capabilities.contactAutofill, false);
assert.match(phoneMissing.items.find(x => x.id === "contacts").detail, /phone/i);

const cvMissing = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: true },
  cv: { english: true, russian: false }, queue: { strongCount: 3 }
});
assert.equal(cvMissing.state, "attention");
assert.equal(cvMissing.capabilities.cvAutoload, false);
assert.equal(cvMissing.capabilities.hhDirect, true, "HH website apply does not require a local PDF vault");
assert.match(cvMissing.items.find(x => x.id === "russian-cv").detail, /HH\.ru.*selected/i);

const queueEmpty = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: true }, contacts: { phone: true },
  cv: { english: true, russian: true }, queue: { strongCount: 0 }
});
assert.equal(queueEmpty.state, "attention");
assert.equal(queueEmpty.capabilities.dailyQueue, false);
assert.equal(queueEmpty.capabilities.hhDirect, true);

const backendDown = readiness.build({
  backend: { reachable: false, ready: false }, candidate: { coreReady: true }, contacts: { phone: true },
  cv: { english: true, russian: true }, queue: { strongCount: 5 }
});
assert.equal(backendDown.state, "blocked");
assert.equal(backendDown.capabilities.externalAts, false);
assert.equal(backendDown.capabilities.hhDirect, false);

const candidateIncomplete = readiness.build({
  backend: { reachable: true, ready: true }, candidate: { coreReady: false }, contacts: { phone: true },
  cv: { english: true, russian: true }, queue: { strongCount: 5 }
});
assert.equal(candidateIncomplete.state, "blocked");
assert.equal(candidateIncomplete.capabilities.hhDirect, false);

console.log("setup-readiness tests passed");
