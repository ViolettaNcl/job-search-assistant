(function () {
  const profile = window.vjaLocalContactProfile;
  if (!profile || profile.__phoneOnly) return;

  const originalValidate = profile.validate.bind(profile);
  const originalApplyToMemory = profile.applyToMemory.bind(profile);
  const originalResolve = profile.resolve.bind(profile);

  profile.validate = function (input = {}) {
    const result = originalValidate({ ...input, linkedin: "" });
    result.values.linkedin = "";
    result.errors.linkedin = "";
    result.ok = !result.errors.phone;
    return result;
  };

  profile.applyToMemory = function (memory = {}, contacts = {}) {
    const next = originalApplyToMemory(memory, { phone: contacts.phone || "", linkedin: "" });
    delete next.linkedin;
    return next;
  };

  profile.resolve = function (input = {}) {
    const state = originalResolve(input);
    return {
      ...state,
      linkedin: "",
      linkedinReady: true,
      bothReady: Boolean(state.phoneReady),
      linkedinSource: "not-used"
    };
  };

  profile.summary = function (state = {}) {
    return state.phoneReady
      ? "Phone number is ready for safe reusable autofill."
      : "Add your phone number once to reduce repeated manual application fields.";
  };

  profile.__phoneOnly = true;
})();
