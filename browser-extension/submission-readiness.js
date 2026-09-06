(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaSubmissionReadiness = api;
})(typeof window !== "undefined" ? window : null, function () {
  function clean(value, fallback = "Unidentified field") {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text || fallback;
  }

  function truncate(value, max = 140) {
    const text = clean(value, "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function build(scan, plan, cv = {}) {
    const fields = Array.isArray(scan?.fields) ? scan.fields : [];
    const resolutions = Array.isArray(plan?.fields) ? plan.fields : [];
    const scanned = new Map(fields.map(field => [field.token, field]));

    const items = resolutions
      .filter(item => {
        const source = scanned.get(item?.token) || {};
        return item?.action === "review" || item?.action === "blocked" || (item?.action === "fill" && source.fillFailed === true);
      })
      .map(item => {
        const source = scanned.get(item.token) || {};
        const failedFill = item.action === "fill" && source.fillFailed === true;
        return {
          token: item.token || "",
          action: failedFill ? "failed" : item.action,
          label: truncate(source.label || item.memoryKey || "Unidentified field", 110),
          reason: truncate(
            failedFill
              ? "Safe autofill did not persist or could not be verified after the ATS page settled. Confirm or re-enter this field manually."
              : item.reason || (item.action === "blocked" ? "Manual answer required." : "Review this answer."),
            180),
          currentValuePresent: Boolean(String(source.currentValue || "").trim()),
          type: String(source.type || "")
        };
      });

    const blockedCount = items.filter(item => item.action === "blocked").length;
    const failedCount = items.filter(item => item.action === "failed").length;
    const reviewCount = items.filter(item => item.action === "review").length;
    const attentionCount = reviewCount + failedCount;
    const state = blockedCount > 0 ? "blocked" : attentionCount > 0 ? "review" : "clear";
    const uploadFields = Number(scan?.uploadFields || 0);
    const uploadedName = clean(cv?.uploadedName, "");
    const recommendedName = clean(cv?.recommendedName, "");

    const cvCheckpoint = uploadedName
      ? {
          status: "inserted",
          label: `CV inserted by extension: ${truncate(uploadedName, 90)}`,
          detail: "Verify the employer page shows this exact attachment before final Submit/Apply."
        }
      : uploadFields > 0 && recommendedName
        ? {
            status: "check",
            label: `Attachment field detected — verify ${truncate(recommendedName, 90)}`,
            detail: "The assistant has not recorded inserting the recommended CV on this analyzed page."
          }
        : {
            status: "unknown",
            label: "CV attachment not verified by the assistant",
            detail: "Some ATS flows reuse an existing profile or do not expose a file field. Check the employer form manually."
          };

    let title;
    let detail;
    if (state === "blocked") {
      title = `${blockedCount} manual-only field${blockedCount === 1 ? "" : "s"} require attention`;
      const extra = attentionCount;
      detail = extra
        ? `There ${extra === 1 ? "is" : "are"} also ${extra} field${extra === 1 ? "" : "s"} to review or verify.`
        : "The assistant intentionally cannot validate or answer these fields for you.";
    } else if (state === "review") {
      title = `${attentionCount} field${attentionCount === 1 ? "" : "s"} still need review`;
      detail = failedCount
        ? `${failedCount} safe autofill attempt${failedCount === 1 ? "" : "s"} could not be verified. Confirm those fields manually before final submission.`
        : "Review these employer-specific or interactive controls before final submission.";
    } else {
      title = "Assistant checklist clear";
      detail = "No unresolved fields were detected by the assistant. Review the entire employer form before final Submit/Apply.";
    }

    return {
      state,
      title,
      detail,
      reviewCount,
      failedCount,
      blockedCount,
      items,
      cvCheckpoint
    };
  }

  return { build };
});
