(() => {
  const node = id => document.getElementById(id);
  window.vjaRenderScreening = report => {
    node('screeningPanel').hidden = !report;
    node('screeningResult').textContent = '';
    if (!report) return;
    node('screeningNotice').textContent = report.notice;
    node('screeningExcerpt').value = report.suggestedResumeExcerpt || '';
    node('screeningActions').replaceChildren();
    for (const action of report.actions || []) {
      const item = document.createElement('li');
      item.textContent = (action.priority === 'High' ? 'Проверить до отправки: ' : '') + action.message;
      node('screeningActions').append(item);
    }
    node('screeningTerms').replaceChildren();
    for (const term of report.requirements || []) {
      const row = document.createElement('p');
      const importance = {Required: 'обязательно', Preferred: 'желательно'}[term.importance] || 'указано в описании';
      const evidence = term.projectIds.length ? `подтверждено проектами: ${term.projectIds.join(', ')}` : 'нет подтверждения в проектах';
      const cv = {Mentioned: 'есть в тексте резюме', 'Not mentioned': 'не найдено в тексте', 'Not checked': 'резюме не проверено'}[term.resumeState];
      row.textContent = `${term.skill} · ${importance} · ${evidence} · ${cv}`;
      node('screeningTerms').append(row);
    }
    node('screeningGaps').textContent = (report.unsupportedRequirements?.length ? `Не добавляйте без подтверждения: ${report.unsupportedRequirements.join(', ')}. ` : '')
      + (report.reviewReasons || []).join(' ');
    if (report.resumeTextChecked) node('screeningResult').textContent = report.verifiedTermsToAdd.length
      ? `Подтверждённые навыки, которые стоит явно описать: ${report.verifiedTermsToAdd.join(', ')}. Это рекомендация; резюме не изменено.`
      : 'Не обнаружено пропущенных терминов среди проверенных навыков. Это не означает, что резюме прошло отбор работодателя.';
  };
  node('checkScreening').addEventListener('click', async () => {
    const vacancy = latestPage;
    if (!vacancy) { node('screeningResult').textContent = 'Сначала проанализируйте вакансию.'; return; }
    const resumeText = node('screeningResume').value.trim();
    if (!resumeText) { node('screeningResult').textContent = 'Вставьте текст выбранного резюме для сравнения.'; return; }
    node('checkScreening').disabled = true;
    node('screeningResult').textContent = 'Сравниваю…';
    try {
      const api = await getApiBase();
      if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(api).hostname)) throw new Error('Проверка личного резюме доступна только через локальную программу.');
      const response = await vjaFetch(`${api}/api/operator/screening`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({vacancy, resumeText})});
      if (!response.ok) throw new Error(`Не удалось проверить резюме (${response.status}). Обновите запущенную программу.`);
      const report = await response.json();
      if (latestPage === vacancy) window.vjaRenderScreening(report);
    } catch (error) {
      if (latestPage === vacancy) node('screeningResult').textContent = error.message;
    } finally { node('checkScreening').disabled = false; }
  });
})();
