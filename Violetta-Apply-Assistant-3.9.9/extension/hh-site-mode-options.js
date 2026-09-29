(function () {
  const button = document.getElementById('connectHh');
  if (!button) return;

  const replacement = button.cloneNode(true);
  button.replaceWith(replacement);
  replacement.id = 'connectHh';
  replacement.textContent = 'HH.ru: автоотклик через сайт включён';
  replacement.title = 'Используется обычная страница HH.ru. Отдельная OAuth-авторизация HH API не требуется.';
  replacement.addEventListener('click', () => {
    window.alert('Режим HH.ru включён. Откройте вакансию и нажмите ✦ Apply: расширение подготовит CV и сопроводительное письмо и выполнит отклик в текущей вкладке, если форма однозначно готова.');
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
