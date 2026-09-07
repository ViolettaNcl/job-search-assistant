(function () {
  const button = document.getElementById('connectHh');
  if (!button) return;

  const replacement = button.cloneNode(true);
  button.replaceWith(replacement);
  replacement.id = 'connectHh';
  replacement.textContent = 'HH.ru website apply enabled';
  replacement.title = 'The local bundle uses the HH.ru website flow. Official HH API OAuth is optional and requires separate developer credentials.';
  replacement.addEventListener('click', () => {
    window.alert('HH.ru website application mode is enabled. Open an HH.ru vacancy and use “Apply now — site + CV + letter”. Official HH API authorization is optional and is not required for normal applications.');
  });

  function patch() {
    const caps = document.getElementById('capabilities');
    if (caps) {
      for (const node of caps.querySelectorAll('.capability')) {
        if (/HH direct apply/i.test(node.textContent || '')) node.textContent = (node.textContent || '').replace(/HH direct apply/i, 'HH website apply');
      }
    }
    const list = document.getElementById('readinessList');
    if (list) {
      for (const row of list.querySelectorAll('.readinessItem')) {
        const text = row.textContent || '';
        if (/HH\.ru authorization|HH\.ru resume selection/i.test(text)) row.style.display = 'none';
      }
    }
  }

  patch();
  new MutationObserver(patch).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
