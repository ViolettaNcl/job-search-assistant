(function () {
  function replaceVisibleText(value) {
    return String(value || '')
      .replace(/Phone \+ LinkedIn/gi, 'Phone ready')
      .replace(/Phone and LinkedIn/gi, 'Phone')
      .replace(/phone and LinkedIn/gi, 'phone')
      .replace(/phone\/LinkedIn/gi, 'phone')
      .replace(/phone or LinkedIn/gi, 'phone')
      .replace(/phone or a LinkedIn URL/gi, 'phone number')
      .replace(/such as a phone or LinkedIn URL/gi, 'such as a phone number')
      .replace(/ and LinkedIn are available/gi, ' is available')
      .replace(/ and LinkedIn are stored locally/gi, ' is stored locally')
      .replace(/phone and LinkedIn values/gi, 'phone value')
      .replace(/phone\/LinkedIn values/gi, 'phone values');
  }

  function patchTextNode(node) {
    const next = replaceVisibleText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function patchTree(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(patchTextNode);

    const linkedIn = document.getElementById('localLinkedIn');
    if (linkedIn) {
      const label = linkedIn.closest('label');
      if (label) label.style.display = 'none';
      linkedIn.value = '';
      linkedIn.setAttribute('aria-hidden', 'true');
      const grid = linkedIn.closest('.fieldGrid');
      if (grid) grid.style.gridTemplateColumns = '1fr';
    }

    const profile = document.getElementById('profileStatus');
    if (profile && /linkedin/i.test(profile.textContent || '')) {
      if (/core profile ready|verified candidate profile ready/i.test(profile.textContent || '')) {
        profile.textContent = 'Verified core candidate profile ready. Phone can be reused for application autofill.';
      } else {
        profile.textContent = replaceVisibleText(profile.textContent).replace(/LinkedIn/gi, '').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
      }
    }

    const memoryNote = document.getElementById('memoryNote');
    if (memoryNote) memoryNote.textContent = replaceVisibleText(memoryNote.textContent).replace(/LinkedIn URL/gi, 'phone number');
  }

  patchTree(document.body);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (node.nodeType === Node.TEXT_NODE) patchTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) patchTree(node);
      }
      if (record.type === 'characterData' && record.target) patchTextNode(record.target);
    }
    const profile = document.getElementById('profileStatus');
    if (profile && /linkedin/i.test(profile.textContent || '')) {
      profile.textContent = 'Verified core candidate profile ready. Phone can be reused for application autofill.';
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
