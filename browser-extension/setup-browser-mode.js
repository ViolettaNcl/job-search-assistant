(function () {
  const readiness = window.vjaSetupReadiness;
  if (!readiness?.build || readiness.__browserMode) return;
  const originalBuild = readiness.build.bind(readiness);

  readiness.build = function (input = {}) {
    const patched = {
      ...input,
      contacts: { ...(input.contacts || {}), linkedin: true }
    };
    const result = originalBuild(patched);
    result.items = (result.items || []).filter(item => item.id !== "hh-auth" && item.id !== "hh-resume");
    result.items.push({
      id: "hh-browser",
      label: "HH.ru browser apply",
      ok: Boolean(result.capabilities?.externalAts),
      level: "recommended",
      detail: result.capabilities?.externalAts
        ? "HH.ru applications use the same browser Apply/Откликнуться workflow as other job sites; OAuth is not required."
        : "Start the backend and verify the candidate profile before using HH.ru browser apply.",
      action: "hh"
    });
    result.passed = result.items.filter(x => x.ok).length;
    result.total = result.items.length;
    result.capabilities = {
      ...(result.capabilities || {}),
      contactAutofill: Boolean(input.contacts?.phone),
      hhDirect: Boolean(result.capabilities?.externalAts)
    };
    return result;
  };
  readiness.__browserMode = true;
})();
