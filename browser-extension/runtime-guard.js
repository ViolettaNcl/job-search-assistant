(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaRuntimeGuard = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function timeoutError(label, timeoutMs) {
    const error = new Error(`${label || "Operation"} timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`);
    error.code = "VJA_TIMEOUT";
    return error;
  }

  function withTimeout(promise, timeoutMs, label = "Operation") {
    const duration = Math.max(1, Number(timeoutMs) || 1);
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError(label, duration)), duration); })
    ]).finally(() => clearTimeout(timer));
  }

  async function fetchWithTimeout(fetchFn, input, init = {}, timeoutMs = 10000) {
    const duration = Math.max(1, Number(timeoutMs) || 10000);
    const controller = new AbortController();
    const externalSignal = init?.signal;
    const onAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) onAbort();
      else externalSignal.addEventListener("abort", onAbort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(timeoutError("Backend request", duration)), duration);
    try {
      return await fetchFn(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !externalSignal?.aborted) throw timeoutError("Backend request", duration);
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener?.("abort", onAbort);
    }
  }

  function messageTimeout(type) {
    if (type === "siteApplyNow") return 60000;
    if (["applyFieldPlan", "uploadCv"].includes(type)) return 20000;
    return 10000;
  }

  function userMessage(error) {
    const value = String(error?.message || error || "Unknown error");
    if (error?.code === "VJA_TIMEOUT" || /timed out|timeout|aborted/i.test(value)) return "Операция не получила ответ вовремя. Обновите вкладку вакансии и нажмите ещё раз — удалять расширение не нужно.";
    if (/receiving end does not exist|could not establish connection|message port closed/i.test(value)) return "Расширение не подключилось к этой вкладке. Обновите страницу вакансии и повторите действие.";
    if (/failed to fetch|networkerror|load failed/i.test(value)) return "Запущенная программа не отвечает. Проверьте окно терминала и адрес http://localhost:8080.";
    return value;
  }

  return { withTimeout, fetchWithTimeout, messageTimeout, userMessage };
});
