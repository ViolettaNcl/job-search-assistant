const assert = require("node:assert/strict");
const receipt = require("./submission-receipt.js");

let result = receipt.detect({
  url: "https://jobs.example.com/application/thank-you",
  title: "Thank you",
  text: "Thank you for applying. We have received your application."
});
assert.equal(result.confirmed, true);
assert.ok(result.score >= 10);

result = receipt.detect({
  url: "https://jobs.example.com/application/submitted",
  title: "Application submitted",
  text: "Your application has been successfully submitted."
});
assert.equal(result.confirmed, true);
assert.equal(result.signal, "application-submitted");

result = receipt.detect({
  url: "https://jobs.example.com/apply",
  title: "Apply",
  text: "Before you submit your application, please review all answers."
});
assert.equal(result.confirmed, false);
assert.equal(result.signal, "negative-or-instructional");

result = receipt.detect({
  url: "https://jobs.example.com/apply",
  title: "Application instructions",
  text: "After you submit, you will see ‘Thank you for applying’. Then you may close this page."
});
assert.equal(result.confirmed, false, "instructional examples of confirmation copy must not count as a receipt");
assert.equal(result.signal, "negative-or-instructional");

result = receipt.detect({
  url: "https://jobs.example.com/application/success",
  title: "Application",
  text: "Continue to the next step."
});
assert.equal(result.confirmed, false, "URL alone must not be enough to record an application");

result = receipt.detect({
  url: "https://example.ru/candidate/confirmation",
  title: "Спасибо за отклик",
  text: "Отклик успешно отправлен."
});
assert.equal(result.confirmed, true);

result = receipt.detect({
  url: "https://jobs.example.com/application/error",
  title: "Submission failed",
  text: "Application was not submitted. Please try again."
});
assert.equal(result.confirmed, false);

console.log("submission-receipt tests passed");
