(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaCandidateConfirmation = api;
})(typeof window !== "undefined" ? window : null, function () {
  const MAX_CONFIRMATIONS = 80;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function fieldIdentity(field) {
    return `${normalize(field?.label)}\u0000${normalize(field?.type)}`;
  }

  function cryptoProvider() {
    if (globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues) return globalThis.crypto;
    if (typeof require === "function") return require("node:crypto").webcrypto;
    throw new Error("Secure hashing is unavailable in this environment.");
  }

  async function sha256Hex(value) {
    const provider = cryptoProvider();
    const bytes = new TextEncoder().encode(String(value || ""));
    const digest = await provider.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    cryptoProvider().getRandomValues(bytes);
    return [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  function sanitizeState(input) {
    const salt = /^[a-f0-9]{32,64}$/i.test(String(input?.salt || "")) ? String(input.salt).toLowerCase() : "";
    const records = Array.isArray(input?.records)
      ? input.records
          .filter(x => /^[a-f0-9]{64}$/i.test(String(x?.fieldHash || "")) && /^[a-f0-9]{64}$/i.test(String(x?.valueHash || "")))
          .slice(-MAX_CONFIRMATIONS)
          .map(x => ({
            fieldHash: String(x.fieldHash).toLowerCase(),
            valueHash: String(x.valueHash).toLowerCase(),
            at: Number(x.at || 0)
          }))
      : [];
    return { salt, records };
  }

  async function fingerprint(field, salt) {
    const currentValue = clean(field?.currentValue);
    if (!currentValue) return null;
    const identity = fieldIdentity(field);
    if (!identity.replace(/\u0000/g, "")) return null;
    const fieldHash = await sha256Hex(`field|${salt}|${identity}`);
    const valueHash = await sha256Hex(`value|${salt}|${identity}|${normalize(currentValue)}`);
    return { fieldHash, valueHash };
  }

  async function confirm(field, inputState, now = Date.now()) {
    const state = sanitizeState(inputState);
    if (!state.salt) state.salt = randomSalt();
    const mark = await fingerprint(field, state.salt);
    if (!mark) throw new Error("Answer or select this field on the employer page before confirming it.");

    const records = state.records.filter(x => x.fieldHash !== mark.fieldHash);
    records.push({ ...mark, at: Number(now) });
    return sanitizeState({ salt: state.salt, records });
  }

  async function annotate(fields, inputState) {
    const state = sanitizeState(inputState);
    const records = new Map(state.records.map(x => [x.fieldHash, x.valueHash]));
    const output = [];
    for (const field of Array.isArray(fields) ? fields : []) {
      let candidateConfirmed = false;
      if (state.salt && clean(field?.currentValue)) {
        const mark = await fingerprint(field, state.salt);
        candidateConfirmed = Boolean(mark && records.get(mark.fieldHash) === mark.valueHash);
      }
      output.push({ ...field, candidateConfirmed });
    }
    return output;
  }

  return {
    MAX_CONFIRMATIONS,
    clean,
    normalize,
    fieldIdentity,
    sanitizeState,
    fingerprint,
    confirm,
    annotate
  };
});