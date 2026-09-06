(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaAtsStructured = api;
})(typeof window !== "undefined" ? window : null, function () {
  function detectAtsHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (/(^|\.)hh\.ru$/.test(host)) return "hh";
    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("lever.co")) return "lever";
    if (host.includes("ashbyhq.com")) return "ashby";
    if (host.includes("myworkdayjobs.com") || host.includes("myworkdaysite.com")) return "workday";
    if (host.includes("smartrecruiters.com")) return "smartrecruiters";
    if (host.includes("teamtailor.com")) return "teamtailor";
    if (host.includes("recruitee.com")) return "recruitee";
    if (host.includes("workable.com")) return "workable";
    if (host.includes("personio.")) return "personio";
    return "generic";
  }

  function typeIncludes(value, expected) {
    const values = Array.isArray(value) ? value : [value];
    return values.some(x => String(x || "").toLowerCase() === expected.toLowerCase());
  }

  function collectJobPostings(value, output = []) {
    if (!value) return output;
    if (Array.isArray(value)) {
      for (const item of value) collectJobPostings(item, output);
      return output;
    }
    if (typeof value !== "object") return output;
    if (typeIncludes(value["@type"], "JobPosting")) output.push(value);
    if (value["@graph"]) collectJobPostings(value["@graph"], output);
    return output;
  }

  function htmlToText(value) {
    return String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim();
  }

  function scalarName(value) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(scalarName).filter(Boolean).join(", ");
    if (typeof value === "object") return scalarName(value.name || value.value || value.addressCountry || "");
    return String(value).trim();
  }

  function addressParts(location) {
    if (!location) return [];
    const rows = Array.isArray(location) ? location : [location];
    const parts = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const address = row.address && typeof row.address === "object" ? row.address : row;
      for (const value of [address.addressLocality, address.addressRegion, address.addressCountry]) {
        const text = scalarName(value);
        if (text && !parts.includes(text)) parts.push(text);
      }
    }
    return parts;
  }

  function firstCountry(job) {
    const locationParts = addressParts(job.jobLocation);
    if (locationParts.length) {
      const locations = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
      for (const row of locations) {
        const address = row?.address && typeof row.address === "object" ? row.address : row;
        const country = scalarName(address?.addressCountry);
        if (country) return country;
      }
    }
    const applicant = job.applicantLocationRequirements;
    if (applicant) {
      const rows = Array.isArray(applicant) ? applicant : [applicant];
      for (const row of rows) {
        const country = scalarName(row?.name || row?.address?.addressCountry || row);
        if (country) return country;
      }
    }
    return "";
  }

  function normalizeJobPosting(job) {
    if (!job || typeof job !== "object") return null;
    const location = addressParts(job.jobLocation).join(", ");
    const remote = /telecommute|remote/i.test(String(job.jobLocationType || "")) ||
      /remote|work from home|distributed/i.test(`${job.title || ""} ${htmlToText(job.description || "")}`);
    const organization = job.hiringOrganization;
    const company = scalarName(organization?.name || organization);
    const experience = scalarName(job.experienceRequirements || job.qualifications || "");
    return {
      title: scalarName(job.title),
      company,
      description: htmlToText(job.description || job.responsibilities || job.qualifications || "").slice(0, 28000),
      location,
      country: firstCountry(job),
      remote,
      employmentType: scalarName(job.employmentType),
      experience: htmlToText(experience).slice(0, 2000)
    };
  }

  function parseJsonLdText(text) {
    try {
      const value = JSON.parse(String(text || "").trim());
      return collectJobPostings(value).map(normalizeJobPosting).filter(Boolean);
    } catch {
      return [];
    }
  }

  function readStructuredJobPosting(documentRef) {
    if (!documentRef?.querySelectorAll) return null;
    const candidates = [];
    for (const script of documentRef.querySelectorAll('script[type="application/ld+json"]')) {
      candidates.push(...parseJsonLdText(script.textContent || script.innerText || ""));
    }
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
      const aScore = Number(Boolean(a.title)) + Number(Boolean(a.company)) + Number(Boolean(a.description)) + Number(Boolean(a.location));
      const bScore = Number(Boolean(b.title)) + Number(Boolean(b.company)) + Number(Boolean(b.description)) + Number(Boolean(b.location));
      return bScore - aScore;
    })[0];
  }

  return {
    detectAtsHost,
    collectJobPostings,
    normalizeJobPosting,
    parseJsonLdText,
    readStructuredJobPosting
  };
});
