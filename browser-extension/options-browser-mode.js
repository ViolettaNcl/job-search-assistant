(function () {
  const linkedin = document.getElementById("localLinkedIn");
  if (linkedin) {
    linkedin.value = "";
    const label = linkedin.closest("label");
    if (label) label.style.display = "none";
    const grid = linkedin.closest(".fieldGrid");
    if (grid) grid.style.gridTemplateColumns = "1fr";
  }

  const connect = document.getElementById("connectHh");
  if (connect) {
    connect.textContent = "Open HH.ru profile";
    connect.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.open("https://hh.ru/applicant/resumes", "_blank", "noopener");
    }, true);
  }

  const replacements = [
    [/Phone \+ LinkedIn/gi, "Phone"],
    [/phone and LinkedIn/gi, "phone"],
    [/phone\/LinkedIn/gi, "phone"],
    [/phone and linkedin/gi, "phone"],
    [/\s*and LinkedIn/gi, ""],
    [/\s*\/ LinkedIn/gi, ""],
    [/HH direct apply/gi, "HH browser apply"],
    [/HH\.ru direct submission/gi, "HH.ru browser submission"],
    [/HH authorization is performed by HH\.ru through the backend OAuth flow\./gi, "HH.ru applications use the browser Apply/Откликнуться workflow; OAuth is not required."],
    [/Local phone\/LinkedIn values/gi, "Local phone values"],
    [/Local phone\/LinkedIn/gi, "Local phone"]
  ];

  function cleanTextNode(node) {
    if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
    let value = node.nodeValue;
    for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
    if (value !== node.nodeValue) node.nodeValue = value;
  }

  function clean(root) {
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) cleanTextNode(node);
  }

  clean(document.body);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (node.nodeType === Node.TEXT_NODE) cleanTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) clean(node);
      }
      if (record.type === "characterData") cleanTextNode(record.target);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
})();
