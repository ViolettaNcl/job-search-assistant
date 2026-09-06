function vjaScanSubmissionReceipt() {
  const detector = window.vjaSubmissionReceipt;
  if (!detector?.detect) return { confirmed: false, score: 0, signal: "detector-unavailable" };
  const text = String(document.body?.innerText || document.body?.textContent || "").slice(0, 50000);
  const result = detector.detect({
    url: location.href,
    title: document.title,
    text
  });
  return {
    confirmed: Boolean(result.confirmed),
    score: Number(result.score || 0),
    signal: String(result.signal || "none")
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "scanSubmissionReceipt") return false;
  try {
    sendResponse(vjaScanSubmissionReceipt());
  } catch (error) {
    sendResponse({ confirmed: false, score: 0, signal: "error", error: error?.message || String(error) });
  }
  return true;
});
