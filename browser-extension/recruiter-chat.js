(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.vjaRecruiterChat = api;
})(typeof self !== 'undefined' ? self : null, function() {
  const ROLE_PATTERNS = [
    ['support', /(support|help\s*desk|service\s*desk|customer\s*service|customer\s*support|chat\s*support|technical\s*support|поддержк|служб[аы]\s+поддерж|чат[- ]?поддерж|клиентск|оператор\s+поддерж)/i],
    ['sales', /(sales|account\s*manager|customer\s*success|client\s*manager|business\s*development|продаж|аккаунт|работ[аы]\s+с\s+клиент|клиентск[а-я]+\s+менедж)/i],
    ['operations', /(operations?|coordinator|administrator|administrative|office\s*manager|assistant|back\s*office|data\s*entry|операцион|координатор|администратор|ассистент|помощник|бэк[- ]?офис|ввод\s+данн)/i],
    ['content', /(content|marketing|social\s*media|smm|moderator|community|copywriter|контент|маркетинг|smm|модератор|соц(?:иальн)?[а-я]*\s+сет)/i],
    ['qa', /(qa|quality\s*assurance|tester|testing|test\s*engineer|тестиров|контрол[ья]\s+качеств)/i],
    ['implementation', /(implementation|integration|onboarding|внедрен|интеграц|сопровожден)/i],
    ['education', /(teacher|tutor|mentor|trainer|education|преподавател|учител|репетитор|наставник|обучен)/i],
    ['developer', /(developer|engineer|programmer|frontend|front-end|backend|back-end|full\s*stack|full-stack|\.net|c#|react|typescript|javascript|разработчик|программист|инженер\s+по\s+разработ)/i]
  ];

  const TECH_STACK = /\b(C#|\.NET|ASP\.NET|Entity\s*Framework|React|Next\.js|TypeScript|JavaScript|Docker|SignalR|JWT|WPF|XAML|GitHub\s*Actions)\b/i;

  function normalize(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function clampText(value, max = 12000) {
    const text = normalize(value);
    if (text.length <= max) return text;
    return text.slice(text.length - max);
  }

  function detectLanguage(text) {
    const value = normalize(text);
    const cyr = (value.match(/[А-Яа-яЁё]/g) || []).length;
    const lat = (value.match(/[A-Za-z]/g) || []).length;
    return cyr >= Math.max(4, lat * 0.35) ? 'ru' : 'en';
  }

  function detectRoleFamily(input = {}) {
    const text = normalize([input.title, input.description, input.threadText, input.url].filter(Boolean).join('\n'));
    for (const [name, pattern] of ROLE_PATTERNS) {
      if (pattern.test(text)) return name;
    }
    return 'general';
  }

  function roleLabel(family, language = 'ru') {
    const ru = {
      support: 'поддержка / работа с клиентами',
      sales: 'клиенты / продажи',
      operations: 'операционная / административная работа',
      content: 'контент / маркетинг',
      qa: 'QA / тестирование',
      implementation: 'внедрение / сопровождение',
      education: 'обучение / работа с людьми',
      developer: 'разработка',
      general: 'универсальная entry-level роль'
    };
    const en = {
      support: 'support / customer communication',
      sales: 'customer / sales',
      operations: 'operations / administration',
      content: 'content / marketing',
      qa: 'QA / testing',
      implementation: 'implementation / onboarding',
      education: 'education / people-facing',
      developer: 'software development',
      general: 'general entry-level role'
    };
    return (language === 'ru' ? ru : en)[family] || family;
  }

  function transferableLine(family, language = 'ru', profile = {}) {
    const facts = (profile.facts || []).filter(f => f.status === 'CONFIRMED' && ['communication','teaching','experience'].includes(f.kind));
    return facts[0]?.text || '';
  }

  function asksAboutExperience(text) {
    return /(?:опыт|работали|работала|умеете|навык|experience|worked\s+with|have\s+you|skills?)/i.test(normalize(text));
  }

  function buildTriageText(snapshot = {}) {
    const vacancy = snapshot.vacancy || {};
    const messages = Array.isArray(snapshot.messages) ? snapshot.messages.slice(-18) : [];
    const threadLines = messages.map((m, index) => {
      const speaker = m.speaker === 'candidate' ? 'Candidate' : m.speaker === 'employer' ? 'Employer' : `Message ${index + 1}`;
      return `${speaker}: ${normalize(m.text)}`;
    }).filter(Boolean);
    const threadText = threadLines.join('\n');
    const family = detectRoleFamily({
      title: vacancy.title,
      description: vacancy.description,
      threadText,
      url: snapshot.url
    });
    const language = detectLanguage(threadText || vacancy.title || vacancy.description);
    const parts = [
      'VACANCY CONTEXT',
      `Title: ${normalize(vacancy.title) || 'Unknown'}`,
      `Company: ${normalize(vacancy.company) || 'Unknown'}`,
      `Role family: ${roleLabel(family, 'en')}`,
      vacancy.description ? `Description excerpt: ${clampText(vacancy.description, 2600)}` : '',
      '',
      'VISIBLE RECRUITER CONVERSATION',
      threadText || clampText(snapshot.visibleText, 7000) || 'No structured messages were detected.',
      '',
      `Latest visible message: ${normalize(snapshot.latestInbound || messages.at(-1)?.text || '')}`,
      `Conversation language: ${language}`
    ].filter(Boolean);
    return clampText(parts.join('\n'), 11800);
  }

  function sentences(text) {
    return normalize(text)
      .replace(/^[-*•]\s*/gm, '')
      .split(/(?<=[.!?])\s+|\n+/)
      .map(normalize)
      .filter(Boolean);
  }

  function simplifyReply(reply, options = {}) {
    const family = options.family || 'general';
    const language = options.language || detectLanguage(reply);
    const latestInbound = normalize(options.latestInbound);
    let items = sentences(reply);

    // For people-facing/non-development roles, keep the answer simple and avoid turning
    // a support reply into a programming pitch.
    if (family !== 'developer' && family !== 'qa') {
      const withoutStack = items.filter(sentence => !TECH_STACK.test(sentence));
      if (withoutStack.length) items = withoutStack;
    }

    // Retain truthful negative answers. Do not append unverified transferable claims.
    let result = normalize(items.join(' '));

    // Avoid wall-of-text recruiter replies. The user can still edit the draft before insertion.
    if (result.length > 1200) result = `${result.slice(0, 1197).trimEnd()}…`;
    return result;
  }

  function fallbackReply(snapshot = {}, family = 'general') {
    const latest = normalize(snapshot.latestInbound || snapshot.messages?.at(-1)?.text || snapshot.visibleText);
    const language = detectLanguage(latest || snapshot.vacancy?.title || '');
    const experience = asksAboutExperience(latest);
    const interview = /(?:интервью|собеседован|созвон|встреч|дата|время|interview|call|meeting|schedule|time slot)/i.test(latest);
    const salary = /(?:зарплат|оклад|вилк|salary|compensation|rate|pay)/i.test(latest);
    const availability = /(?:когда\s+готов|выход|приступ|notice\s+period|available\s+to\s+start|start\s+date)/i.test(latest);

    if (language === 'ru') {
      if (interview) return 'Здравствуйте! Спасибо за сообщение. Вакансия мне интересна. Подскажите, пожалуйста, удобные дату, время и формат собеседования — я сверю и подтвержу.';
      if (salary) return 'Здравствуйте! Спасибо за сообщение. Готова обсудить условия. Хотелось бы сначала уточнить задачи, формат работы и ожидания по роли, после этого смогу предметно обсудить уровень компенсации.';
      if (availability) return 'Здравствуйте! Спасибо за сообщение. Вакансия мне интересна. Точную дату выхода смогу подтвердить после уточнения формата работы и следующих этапов.';
      if (experience) return `Здравствуйте! Спасибо за вопрос. ${transferableLine(family, 'ru', snapshot.profile || {})} Буду рада уточнить детали по задачам, которые для вас наиболее важны.`;
      return 'Здравствуйте! Спасибо за сообщение. Вакансия мне интересна. Готова уточнить детали и ответить на ваши вопросы.';
    }

    if (interview) return 'Hello, thank you for the message. I am interested in the role. Please share a suitable date, time, and interview format, and I will confirm it.';
    if (salary) return 'Hello, thank you for the message. I am open to discussing compensation. I would first like to clarify the responsibilities, work format, and expectations for the role so I can discuss it properly.';
    if (availability) return 'Hello, thank you for the message. I am interested in the role. I can confirm an exact start date after we clarify the work format and next steps.';
    if (experience) return `Hello, thank you for the question. ${transferableLine(family, 'en', snapshot.profile || {})} I would be happy to clarify the parts of the role that are most important to you.`;
    return 'Hello, thank you for the message. I am interested in the role and would be happy to clarify the details and answer your questions.';
  }

  function signature(snapshot = {}) {
    const source = normalize([
      snapshot.url,
      snapshot.vacancy?.title,
      snapshot.vacancy?.company,
      snapshot.latestInbound,
      snapshot.messages?.slice(-4).map(m => m.text).join('|')
    ].join('|'));
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `chat-${(hash >>> 0).toString(16)}`;
  }

  return {
    normalize,
    clampText,
    detectLanguage,
    detectRoleFamily,
    roleLabel,
    transferableLine,
    asksAboutExperience,
    buildTriageText,
    simplifyReply,
    fallbackReply,
    signature
  };
});
