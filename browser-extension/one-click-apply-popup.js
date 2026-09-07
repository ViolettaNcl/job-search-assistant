(function () {
  const markButton = document.getElementById("markApplied");
  const hhButton = document.getElementById("applyHh");
  const memoryNote = document.getElementById("memoryNote");
  const fillNote = document.getElementById("fillNote");
  const profileStatus = document.getElementById("profileStatus");

  if (markButton) markButton.textContent = "Apply now";
  if (hhButton) hhButton.textContent = "Apply now on HH.ru";
  if (memoryNote) memoryNote.textContent = "Application Memory stores only answers you explicitly confirmed in this browser, such as your phone number. Salary, legal, medical and other sensitive answers are never learned automatically.";

  const textObserver = new MutationObserver(() => {
    if (profileStatus?.textContent?.includes("phone and LinkedIn")) {
      profileStatus.textContent = profileStatus.textContent.replace(/phone and LinkedIn/gi, "phone");
    }
    if (profileStatus?.textContent?.includes("LinkedIn")) {
      profileStatus.textContent = profileStatus.textContent.replace(/,?\s*LinkedIn/gi, "");
    }
  });
  if (profileStatus) textObserver.observe(profileStatus, { childList: true, characterData: true, subtree: true });

  async function selectedCvData() {
    if (!latest?.draft) return null;
    const recommended = String(latest.draft.recommendedCv || "").toLowerCase();
    const preferRu = /russian|рус|_ru|\bru\b/.test(recommended) || String(latest.draft.language || "").toLowerCase().startsWith("ru");
    const keys = preferRu ? ["cvVaultRu", "cvVaultEn"] : ["cvVaultEn", "cvVaultRu"];
    const stored = await chrome.storage.local.get(keys);
    return stored[keys[0]]?.base64 ? stored[keys[0]] : stored[keys[1]]?.base64 ? stored[keys[1]] : null;
  }

  async function recordApplied() {
    try {
      const id = await ensureTracked();
      const api = await getApiBase();
      const response = await fetch(`${api}/api/vacancies/${id}/mark-applied`, { method: "POST" });
      if (!response.ok) throw new Error(`Tracker returned ${response.status}.`);
      if (markButton) markButton.textContent = "Applied ✓";
      if (hhButton) hhButton.textContent = "Applied ✓";
    } catch (error) {
      if (fillNote) fillNote.textContent = `The employer-site application was submitted, but CRM recording needs attention: ${error?.message || String(error)}`;
    }
  }

  async function applyNow(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    clearError?.();

    try {
      setBusy?.(true);
      if (!latest) await analyze();
      if (!latest || !latestPage) throw new Error("Could not analyze this vacancy.");

      const confirmed = window.confirm(`Apply to this vacancy now?\n\nFit: ${latest.match?.score ?? "—"}/100\n${latestPage.title || "Vacancy"}\n\nThe assistant will press the employer Apply/Откликнуться button, fill verified-safe fields, insert the tailored letter and local CV where the site exposes a CV field, then submit only when no unresolved fields remain.`);
      if (!confirmed) return;

      const fileData = await selectedCvData();
      const begin = await sendToPage({
        type: "beginSiteApplication",
        coverLetter: document.getElementById("coverLetter")?.value || latest.draft.coverLetter || "",
        fileData
      });
      if (!begin?.success) throw new Error(begin?.error || "Could not open the employer application form.");
      if (begin.redirected) {
        if (fillNote) fillNote.textContent = "The employer Apply button redirected to the next application page. Reopen the extension there and press Apply now again to finish the form.";
        return;
      }

      await refreshFieldPlan();
      const fill = await sendToPage({ type: "applyFieldPlan", resolutions: latestPlan.fields || [] });
      if (fill?.error) throw new Error(fill.error);

      await refreshFieldPlan();
      const unresolved = Number(latestPlan.reviewCount || 0) + Number(latestPlan.blockedCount || 0);
      if (unresolved > 0) {
        if (fillNote) fillNote.textContent = `Application prepared, including the cover letter${begin.cv?.success ? " and CV" : ""}, but ${unresolved} field${unresolved === 1 ? "" : "s"} still require your answer. Complete them, then press Apply now again.`;
        return;
      }

      const submit = await sendToPage({ type: "submitSiteApplication" });
      if (!submit?.success || !submit?.submitted) throw new Error(submit?.error || "The final employer Submit/Откликнуться button was not found.");

      if (fillNote) {
        const cvText = begin.cv?.success
          ? ` CV ${begin.cv.filename} was inserted.`
          : begin.cv?.noField
            ? " The site did not expose a CV upload field, so its own profile/resume workflow is being used."
            : fileData
              ? " The stored CV could not be inserted automatically."
              : " No local CV was available in CV Vault.";
        fillNote.textContent = `Employer-site submission clicked successfully.${cvText} Recording the application in the tracker…`;
      }
      await recordApplied();
    } catch (error) {
      showError?.(error?.message || String(error));
    } finally {
      setBusy?.(false);
    }
  }

  for (const button of [markButton, hhButton].filter(Boolean)) {
    button.addEventListener("click", applyNow, true);
  }
})();
