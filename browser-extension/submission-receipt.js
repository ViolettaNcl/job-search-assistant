(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.vjaSubmissionReceipt = api;
})(typeof window !== "undefined" ? window : null, function () {
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function detect(input = {}) {
    const text = normalize(input.text).slice(0, 50000);
    const title = normalize(input.title);
    const url = normalize(input.url);

    const negativeOrInstructional = [
      /application (?:is |was )?not submitted|submission failed|could not submit|submit your application|before (?:you )?submit|ready to submit|заявка не отправлена|не удалось отправить/i,
      /(?:after|once|when) (?:you )?(?:submit|have submitted|send|have sent).{0,120}thank you for (?:your application|applying)/i,
      /you (?:will|should|may) see.{0,120}thank you for (?:your application|applying)/i,
      /(?:after|once|when) (?:вы )?(?:отправите|отправили).{0,120}(?:спасибо за (?:ваш )?отклик|отклик (?:успешно )?отправлен)/i
    ];
    if (negativeOrInstructional.some(pattern => pattern.test(text))) {
      return { confirmed: false, score: 0, signal: "negative-or-instructional" };
    }

    let score = 0;
    let signal = "none";
    const strong = [
      [/application (?:has been |was |is )?(?:successfully )?submitted/i, "application-submitted"],
      [/we (?:have )?received your application/i, "application-received"],
      [/thank you for (?:your application|applying)/i, "thank-you"],
      [/your application (?:has been )?received/i, "application-received"],
      [/application complete(?:d)?/i, "application-complete"],
      [/заявк[аи] (?:успешно )?отправлен[аы]/i, "application-submitted"],
      [/отклик (?:успешно )?отправлен/i, "application-submitted"],
      [/спасибо за (?:ваш )?отклик/i, "thank-you"],
      [/мы получили (?:вашу )?(?:заявку|отклик)/i, "application-received"]
    ];

    for (const [pattern, name] of strong) {
      if (pattern.test(text) || pattern.test(title)) {
        score += 10;
        signal = name;
        break;
      }
    }

    if (/(?:thank[-_]?you|thankyou|submitted|submission-success|application-complete|application-submitted|confirmation|success)(?:\/|\?|#|$)/i.test(url)) score += 4;
    if (/thank you|submitted|application received|application complete|спасибо|отправлен/i.test(title)) score += 3;

    return {
      confirmed: score >= 10,
      score,
      signal: score >= 10 ? signal : "insufficient-evidence"
    };
  }

  return { clean, normalize, detect };
});
