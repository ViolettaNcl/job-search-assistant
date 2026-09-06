(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaLocalContactProfile = api;
})(typeof window !== "undefined" ? window : null, function () {
  const memoryKeys = Object.freeze({ phone: "phone", linkedin: "linkedin" });

  function text(value) {
    return String(value || "").trim();
  }

  function normalizePhone(value) {
    return text(value).replace(/\s+/g, " ");
  }

  function validatePhone(value) {
    const phone = normalizePhone(value);
    if (!phone) return "";
    if (!/^\+?[0-9().\-\s]+$/.test(phone))
      return "Use only digits and normal phone punctuation such as +, spaces, parentheses or hyphens.";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15)
      return "Phone number should contain between 7 and 15 digits.";
    return "";
  }

  function normalizeLinkedIn(value) {
    let raw = text(value);
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
      const parsed = new URL(raw);
      if (!/^https?:$/.test(parsed.protocol)) return "";
      parsed.hash = "";
      return parsed.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  }

  function validateLinkedIn(value) {
    const raw = text(value);
    if (!raw) return "";
    const normalized = normalizeLinkedIn(raw);
    if (!normalized) return "Enter a valid LinkedIn URL.";
    try {
      const parsed = new URL(normalized);
      const host = parsed.hostname.toLowerCase();
      const linkedinHost = host === "linkedin.com" || host.endsWith(".linkedin.com");
      if (!linkedinHost) return "Use a linkedin.com profile URL.";
      if (!parsed.pathname || parsed.pathname === "/") return "Use your LinkedIn profile URL, not the LinkedIn home page.";
      return "";
    } catch {
      return "Enter a valid LinkedIn URL.";
    }
  }

  function validate(input = {}) {
    const values = {
      phone: normalizePhone(input.phone),
      linkedin: normalizeLinkedIn(input.linkedin)
    };
    const errors = {
      phone: validatePhone(input.phone),
      linkedin: validateLinkedIn(input.linkedin)
    };
    return {
      ok: !errors.phone && !errors.linkedin,
      values,
      errors
    };
  }

  function applyToMemory(memory = {}, contacts = {}) {
    const next = { ...(memory || {}) };
    const phone = normalizePhone(contacts.phone);
    const linkedin = normalizeLinkedIn(contacts.linkedin);
    if (phone) next[memoryKeys.phone] = phone;
    else delete next[memoryKeys.phone];
    if (linkedin) next[memoryKeys.linkedin] = linkedin;
    else delete next[memoryKeys.linkedin];
    return next;
  }

  function candidateValue(candidate, names) {
    for (const name of names) {
      const value = text(candidate?.[name]);
      if (value) return value;
    }
    return "";
  }

  function resolve(input = {}) {
    const candidate = input.candidate || {};
    const memory = input.memory || {};
    const verifiedPhone = candidateValue(candidate, ["phone", "Phone"]);
    const verifiedLinkedIn = candidateValue(candidate, ["linkedInUrl", "linkedinUrl", "LinkedInUrl", "LinkedinUrl"]);
    const localPhone = normalizePhone(memory[memoryKeys.phone]);
    const localLinkedIn = normalizeLinkedIn(memory[memoryKeys.linkedin]);
    const phone = verifiedPhone || localPhone;
    const linkedin = verifiedLinkedIn || localLinkedIn;
    return {
      phone,
      linkedin,
      phoneReady: Boolean(phone),
      linkedinReady: Boolean(linkedin),
      bothReady: Boolean(phone && linkedin),
      phoneSource: verifiedPhone ? "backend" : localPhone ? "local" : "missing",
      linkedinSource: verifiedLinkedIn ? "backend" : localLinkedIn ? "local" : "missing"
    };
  }

  function summary(state = {}) {
    if (state.phoneReady && state.linkedinReady)
      return "Phone and LinkedIn are ready for safe reusable autofill.";
    const missing = [];
    if (!state.phoneReady) missing.push("phone");
    if (!state.linkedinReady) missing.push("LinkedIn");
    return `Add ${missing.join(" and ")} once to reduce manual application fields.`;
  }

  return {
    memoryKeys,
    normalizePhone,
    normalizeLinkedIn,
    validatePhone,
    validateLinkedIn,
    validate,
    applyToMemory,
    resolve,
    summary
  };
});
