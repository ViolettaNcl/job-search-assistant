(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaBrowserAutopilot = api;
})(typeof self !== "undefined" ? self : null, function () {
  const defaultPreferences={
    programmingOnly:true,
    remoteOnly:true,
    sessionLimit:5,
    searchQueries:['Junior C# .NET','Junior ASP.NET Core','Junior Backend C#','Junior Full-Stack .NET','Junior QA Automation C#','Junior Manual QA','Technical Support remote']
  };
  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (!/^https?:$/.test(url.protocol)) return "";
      url.hash = "";
      return url.toString();
    } catch { return ""; }
  }
  function isHhVacancy(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === 'https:' && (url.hostname === "hh.ru" || url.hostname.endsWith(".hh.ru")) && /^\/vacancy\/\d+\/?$/i.test(url.pathname);
    } catch { return false; }
  }
  function shouldRun(status = {}) {
    if (!status.autoApplyEnabled || !status.allowed) return false;
    if (status.apiReady && status.automationMode === "hh-api") return false;
    return Number(status.remainingToday || 0) > 0;
  }
  function hasSafeSeniority(title) {
    return !/\b(senior|lead|principal|staff|architect|head|manager|middle|mid[- ]?level)\b|ведущ|руководител|главн(?:ый|ая)|архитектор|тимлид|мидл|средн(?:ий|яя) уровень/i.test(String(title || ""));
  }
  function isProgrammingRole(title=''){
    return /(?:c#|\.net|asp\.net|backend|back-end|full.?stack|frontend|front-end|software|developer|engineer|программист|разработчик|разработка|веб.?разработ|wpf|xaml|react|typescript|javascript|php|qa automation|automation qa|manual qa|qa engineer|quality assurance|тестировщик|тестирование|автоматизац.*тест|technical support|support engineer|helpdesk|service desk|тех(?:ническ(?:ая|ой))? поддерж|поддержк.*it)/i.test(String(title||''));
  }
  function normalizePreferences(input={}){
    const q=Array.isArray(input.searchQueries)?input.searchQueries.map(x=>String(x||'').trim()).filter(Boolean).slice(0,12):defaultPreferences.searchQueries;
    return {
      programmingOnly:input.programmingOnly!==false,
      remoteOnly:input.remoteOnly!==false,
      sessionLimit:Math.min(20,Math.max(1,Number(input.sessionLimit)||defaultPreferences.sessionLimit)),
      searchQueries:q.length?q:defaultPreferences.searchQueries
    };
  }
  function selectCandidate(queue = [], minimumScore = 75, preferences={}) {
    const prefs=normalizePreferences(preferences);
    return (Array.isArray(queue) ? queue : []).find(item => {
      const url = normalizeUrl(item?.url);
      if (!isHhVacancy(url)) return false;
      if (Number(item?.matchScore || 0) < Number(minimumScore || 75)) return false;
      if (!hasSafeSeniority(item?.title)) return false;
      if (prefs.programmingOnly && !isProgrammingRole(item?.title)) return false;
      // Search itself is forced to remote when remoteOnly is on. If the queue
      // carries an explicit remote=false flag, reject it as an extra guard.
      if (prefs.remoteOnly && item?.remote === false) return false;
      return true;
    }) || null;
  }
  function buildPlan(item = {}, draft = {}, now = Date.now()) {
    const sourceUrl = normalizeUrl(item.url);
    return {
      id: `browser-auto-${now}-${String(item.vacancyId || "")}`,
      trackedId: String(item.vacancyId || ""),
      sourceUrl,
      sourceHost: sourceUrl ? new URL(sourceUrl).hostname : "",
      jobTitle: String(item.title || ""),
      coverLetter: String(draft.coverLetter || "").trim(),
      cvKey: "",
      resumeHint: String(draft.resumeHint || draft.recommendedHeadline || draft.recommendedCv || item.recommendedCv || ""),
      letterVersion: String(draft.letterVersion || "3.7-context-github"),
      roleVariant: String(draft.strategy?.cvVariant || "developer"),
      siteKind: "hh",
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      finalClicked: false,
      automatic: true
    };
  }
  return { defaultPreferences, normalizePreferences, normalizeUrl, isHhVacancy, shouldRun, hasSafeSeniority, isProgrammingRole, selectCandidate, buildPlan };
});
