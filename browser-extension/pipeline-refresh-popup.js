let vjaPipelineRefreshTimer = null;
let vjaPipelineRefreshSignature = "";

function vjaPipelineRefreshSignal() {
  const mark = $("markApplied")?.textContent || "";
  const hh = $("applyHh")?.textContent || "";
  const receipt = $("recordSubmissionReceipt")?.textContent || "";
  return `${mark}|${hh}|${receipt}`;
}

function vjaSchedulePipelineLifecycleRefresh() {
  const signature = vjaPipelineRefreshSignal();
  if (signature === vjaPipelineRefreshSignature) return;
  vjaPipelineRefreshSignature = signature;
  if (!/(Applied|Recorded)/i.test(signature)) return;

  clearTimeout(vjaPipelineRefreshTimer);
  vjaPipelineRefreshTimer = setTimeout(() => {
    window.vjaLoadPipelineDesk?.({ quiet: true }).catch(() => {});
  }, 120);
}

const vjaPipelineRefreshRoot = document.querySelector("main") || document.body;
if (vjaPipelineRefreshRoot) {
  vjaPipelineRefreshSignature = vjaPipelineRefreshSignal();
  new MutationObserver(vjaSchedulePipelineLifecycleRefresh).observe(vjaPipelineRefreshRoot, {
    childList: true,
    characterData: true,
    subtree: true
  });
}
