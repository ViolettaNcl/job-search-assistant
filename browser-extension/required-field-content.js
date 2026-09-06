(function () {
  if (typeof scanFields !== "function" || !window.vjaRequiredFieldState) return;

  const originalScanFields = scanFields;

  function fieldElement(token) {
    if (!token) return null;
    try {
      return document.querySelector(`[data-vja-field-token="${CSS.escape(token)}"]`);
    } catch {
      return null;
    }
  }

  function nativeRadioGroup(el) {
    if (!(el instanceof HTMLInputElement) || el.type !== "radio" || !el.name) return null;
    const candidates = [...document.getElementsByName(el.name)]
      .filter(node => node instanceof HTMLInputElement && node.type === "radio")
      .filter(node => node.form === el.form);
    return candidates.length ? candidates : null;
  }

  function requiredMeta(el, field) {
    if (!el) return null;

    const nativeRequired = Boolean(el.required === true || el.hasAttribute?.("required"));
    const ariaRequired = String(el.getAttribute?.("aria-required") || "").toLowerCase() === "true";
    let groupRequired = false;
    let groupSatisfied = null;
    let groupKey = "";

    const radios = nativeRadioGroup(el);
    if (radios) {
      groupRequired = radios.some(node => node.required === true || node.hasAttribute("required") || node.getAttribute("aria-required") === "true");
      groupSatisfied = radios.some(node => node.checked === true);
      groupKey = `radio:${el.form?.id || "form"}:${el.name}`;
    } else if (field?.type === "radiogroup") {
      groupRequired = ariaRequired || Boolean(el.querySelector?.("[role='radio'][aria-required='true']"));
      groupSatisfied = Boolean(el.querySelector?.("[role='radio'][aria-checked='true']"));
      groupKey = `radiogroup:${field.token || "unknown"}`;
    }

    return window.vjaRequiredFieldState.evaluate({
      token: field?.token,
      label: field?.label,
      currentValue: field?.currentValue,
      nativeRequired,
      ariaRequired,
      groupRequired,
      groupSatisfied,
      groupKey
    });
  }

  scanFields = function () {
    const result = originalScanFields();
    if (!Array.isArray(result?.fields)) return result;

    result.fields = result.fields.map(field => {
      const meta = requiredMeta(fieldElement(field.token), field);
      if (!meta) return field;
      return {
        ...field,
        required: meta.required,
        requiredSatisfied: meta.satisfied,
        requiredKey: meta.key
      };
    });

    result.requiredMissing = window.vjaRequiredFieldState.uniqueMissing(result.fields).length;
    return result;
  };
})();