(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaPrepareApplication = api;
})(typeof window !== "undefined" ? window : null, function () {
  function number(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function summarize(input = {}) {
    const analyzed = Boolean(input.analyzed);
    const detectedFields = number(input.detectedFields);
    const filled = number(input.filled);
    const failed = number(input.failed);
    const review = number(input.review);
    const blocked = number(input.blocked);
    const cv = input.cv || "not-attempted";
    const hh = Boolean(input.hh);

    let state = "partial";
    if (!analyzed) state = "failed";
    else if (!detectedFields && !hh) state = "analysis-only";
    else if (failed || review || blocked || cv === "failed" || cv === "missing") state = "needs-review";
    else state = "prepared";

    const parts = [];
    if (analyzed) parts.push("vacancy analyzed and tailored");
    if (detectedFields) parts.push(`${filled} safe field${filled === 1 ? "" : "s"} verified`);
    else if (analyzed && !hh) parts.push("no application fields detected on this page");
    else if (analyzed && hh) parts.push("HH application draft is ready");

    if (cv === "uploaded") parts.push("recommended CV inserted");
    else if (cv === "missing") parts.push("recommended CV is not stored in the local vault");
    else if (cv === "no-field") parts.push("no CV upload field detected on this stage");
    else if (cv === "failed") parts.push("CV insertion needs manual attention");

    if (failed) parts.push(`${failed} autofill verification failure${failed === 1 ? "" : "s"}`);
    if (review) parts.push(`${review} field${review === 1 ? "" : "s"} need review`);
    if (blocked) parts.push(`${blocked} field${blocked === 1 ? "" : "s"} are manual-only`);
    if (hh) parts.push("HH submission remains a separate confirmed action");

    return {
      state,
      analyzed,
      detectedFields,
      filled,
      failed,
      review,
      blocked,
      cv,
      hh,
      message: parts.join(" · ")
    };
  }

  function buttonLabel(state) {
    if (state === "prepared") return "Prepared ✓";
    if (state === "needs-review") return "Prepared — review needed";
    if (state === "analysis-only") return "Tailored — open application form";
    if (state === "failed") return "Preparation failed";
    return "Prepare application";
  }

  return { summarize, buttonLabel };
});