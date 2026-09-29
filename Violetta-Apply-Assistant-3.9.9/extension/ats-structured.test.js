const assert = require("node:assert/strict");
const ats = require("./ats-structured.js");

function testHostDetection() {
  const cases = new Map([
    ["hh.ru", "hh"],
    ["boards.greenhouse.io", "greenhouse"],
    ["jobs.lever.co", "lever"],
    ["jobs.ashbyhq.com", "ashby"],
    ["company.wd3.myworkdayjobs.com", "workday"],
    ["jobs.smartrecruiters.com", "smartrecruiters"],
    ["jobs.teamtailor.com", "teamtailor"],
    ["company.recruitee.com", "recruitee"],
    ["apply.workable.com", "workable"],
    ["company.jobs.personio.de", "personio"],
    ["careers.example.com", "generic"]
  ]);
  for (const [host, expected] of cases) assert.equal(ats.detectAtsHost(host), expected, host);
}

function testJsonLdNormalization() {
  const rows = ats.parseJsonLdText(JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Junior .NET Developer",
    hiringOrganization: { "@type": "Organization", name: "Example Labs" },
    description: "<p>Build APIs with <strong>C#</strong>.</p><p>Remote in the EU.</p>",
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "Cyprus" },
    employmentType: ["FULL_TIME", "CONTRACTOR"],
    experienceRequirements: "Junior / graduate",
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Limassol",
        addressCountry: "Cyprus"
      }
    }
  }));

  assert.equal(rows.length, 1);
  const job = rows[0];
  assert.equal(job.title, "Junior .NET Developer");
  assert.equal(job.company, "Example Labs");
  assert.equal(job.country, "Cyprus");
  assert.equal(job.location, "Limassol, Cyprus");
  assert.equal(job.remote, true);
  assert.match(job.description, /Build APIs with C#\./);
  assert.match(job.description, /Remote in the EU\./);
  assert.equal(job.experience, "Junior / graduate");
}

function testGraphAndBestCandidateSelection() {
  const scripts = [
    {
      textContent: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", name: "Ignored" },
          {
            "@type": ["Thing", "JobPosting"],
            title: "Backend Engineer",
            hiringOrganization: { name: "Acme" },
            description: "C# and ASP.NET Core",
            jobLocation: { address: { addressLocality: "Berlin", addressCountry: { name: "Germany" } } }
          }
        ]
      })
    },
    { textContent: "{ not valid json" }
  ];
  const fakeDocument = {
    querySelectorAll(selector) {
      assert.equal(selector, 'script[type="application/ld+json"]');
      return scripts;
    }
  };

  const job = ats.readStructuredJobPosting(fakeDocument);
  assert.ok(job);
  assert.equal(job.title, "Backend Engineer");
  assert.equal(job.company, "Acme");
  assert.equal(job.country, "Germany");
  assert.equal(job.location, "Berlin, Germany");
}

function testMalformedJsonIsSafe() {
  assert.deepEqual(ats.parseJsonLdText(""), []);
  assert.deepEqual(ats.parseJsonLdText("not-json"), []);
  assert.equal(ats.readStructuredJobPosting({ querySelectorAll: () => [] }), null);
}

testHostDetection();
testJsonLdNormalization();
testGraphAndBestCandidateSelection();
testMalformedJsonIsSafe();
console.log("ats-structured tests passed");
