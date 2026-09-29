# Recruiter Chat Copilot — 2.9.0

Version 2.9.0 changes recruiter chat assistance from an automatic floating-panel guess into an explicit on-page tool.

## Workflow

1. Open a recruiter/employer conversation on a supported job site.
2. When the extension recognizes the message composer and conversation context, a small **✎ AI** button appears beside the reply field.
3. Click **✎ AI**. Only then does the extension collect the currently loaded conversation, nearby vacancy context, current URL and the latest recruiter message.
4. The extension sends that context through the existing local backend endpoint `POST /api/operator/recruiter/triage`.
5. A compact panel opens above the composer with:
   - conversation/vacancy context;
   - recruiter intent/next-step analysis when available;
   - an editable suggested reply;
   - `Короче`, `Дружелюбнее`, and `Увереннее` rewrite modes;
   - `Вставить в чат`, `Обновить`, and `Копировать` actions.
6. **Nothing is sent automatically.** `Вставить в чат` only fills the employer site's composer. The user still reviews the result and presses Send manually.

## Better chat detection

The detector now recognizes additional chat/negotiation structures, including selectors commonly used for `chatik`/negotiation-style UIs. When the DOM does not explicitly mark the author, bubble alignment is used only as a fallback to distinguish candidate and employer messages.

The assistant reads the conversation currently loaded in the page DOM. On sites that virtualize old chat history, messages that the site has not loaded cannot be analyzed until they are loaded by the site.

## Role-aware wording

The reply layer supports broad role families such as support/customer communication, sales/customer success, operations/admin, content/marketing, QA, implementation, education/people-facing work, software development, and general roles.

For non-development roles it avoids turning every answer into a programming pitch. It can use transferable experience, but it must not invent employers, years of commercial experience, certificates, salaries, dates, achievements, or technologies not supported by the candidate profile/context.

## Safety

- Explicit user click starts analysis.
- Draft remains editable.
- Extension never clicks the employer site's Send button.
- AI rewrite styles must not invent additional experience.
- If the local backend/AI provider is unavailable, a conservative local fallback draft is shown and labeled.
