(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.vjaFloatingPanel = api;
})(typeof self !== 'undefined' ? self : null, function() {
  function automatic(url) {
    try {
      const u = new URL(url);
      return /(^|\.)hh\.ru$/.test(u.hostname) && /^\/vacancy\/\d+/.test(u.pathname);
    } catch { return false; }
  }
  function allowed(url) {
    try { const u = new URL(url); return /^https?:$/.test(u.protocol) && !/(^|\.)linkedin\.com$/.test(u.hostname); } catch { return false; }
  }
  function position(x, y, width, height, panelWidth = 420, panelHeight = 540) {
    return { x: Math.max(0, Math.min(Number.isFinite(x) ? x : width - panelWidth - 20, Math.max(0, width - Math.min(panelWidth, width)))),
      y: Math.max(0, Math.min(Number.isFinite(y) ? y : 70, Math.max(0, height - Math.min(panelHeight, height)))) };
  }
  return { automatic, allowed, position };
});
