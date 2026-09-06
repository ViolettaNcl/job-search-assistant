(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaFinalReviewGate = api;
})(typeof window !== "undefined" ? window : null, function () {
  function number(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function evaluate(readiness, submitControl = null) {
    if (!readiness) {
      return { state: "not-analyzed", title: "Analyze the application first", canLocateSubmit: false, canConfirmReview: false };
    }

    const unresolved = number(readiness.reviewCount) + number(readiness.failedCount) + number(readiness.blockedCount);
    if (unresolved) {
      return {
        state: "unresolved",
        title: `${unresolved} checkpoint${unresolved === 1 ? "" : "s"} still need attention`,
        canLocateSubmit: false,
        canConfirmReview: false
      };
    }

    const cvStatus = readiness.cvCheckpoint?.status || "unknown";
    if (cvStatus === "check") {
      return {
        state: "attachment-review",
        title: "Verify the CV attachment before final review",
        canLocateSubmit: false,
        canConfirmReview: false
      };
    }

    if (submitControl?.ambiguous) {
      return {
        state: "submit-ambiguous",
        title: "More than one possible final action was found",
        canLocateSubmit: true,
        canConfirmReview: true
      };
    }

    if (submitControl?.found) {
      return {
        state: "ready",
        title: "Ready for final human review",
        canLocateSubmit: true,
        canConfirmReview: true,
        submitLabel: String(submitControl.label || "Submit/Apply")
      };
    }

    return {
      state: "ready-no-submit",
      title: "Checklist clear — review the full employer form",
      canLocateSubmit: true,
      canConfirmReview: true
    };
  }

  function afterCandidateReview(gate) {
    if (!gate?.canConfirmReview) return { state: gate?.state || "not-ready", readyToSubmit: false };
    return {
      state: "candidate-reviewed",
      readyToSubmit: true,
      title: gate.submitLabel
        ? `Final review complete — use “${gate.submitLabel}” on the employer page when ready`
        : "Final review complete — use the employer's final Submit/Apply control when ready"
    };
  }

  return { evaluate, afterCandidateReview };
});