const test = require('node:test');
const assert = require('node:assert/strict');
const { buildConversationGuide } = require('../dist/chat/conversation-guide.js');

test('conversation guide keeps very general openings in clarify stage', () => {
  const guide = buildConversationGuide([
    { role: 'assistant', content: 'Hi! Wie kann ich helfen?' },
    { role: 'user', content: 'ich brauche eine ki' },
  ]);

  assert.match(guide, /Gesprächsphase: clarify/);
  assert.match(guide, /genau eine gezielte Qualifizierungsfrage/i);
});

test('conversation guide marks contact intent as contact-ready', () => {
  const guide = buildConversationGuide([
    { role: 'assistant', content: 'Das sollten wir uns kurz gemeinsam anschauen. Möchtest du lieber einen Termin oder eine Anfrage?' },
    { role: 'user', content: 'termin ausmachen' },
  ]);

  assert.match(guide, /Gesprächsphase: contact-ready/);
  assert.match(guide, /direkt zur Kontaktaufnahme weiter/i);
});

test('conversation guide uses customer-specific flow questions and instructions', () => {
  const guide = buildConversationGuide(
    [
      { role: 'assistant', content: 'Hi! Wie kann ich helfen?' },
      { role: 'user', content: 'ich brauche eine ki' },
    ],
    {
      questions: {
        opening: 'Geht es bei dir eher um Termine, Support oder interne Prozesse?',
      },
      instructions: {
        clarify: 'Nutze im Einstieg immer zuerst die kundenspezifische Leitfrage.',
      },
    },
  );

  assert.match(guide, /Gesprächsphase: clarify/);
  assert.match(guide, /kundenspezifische Leitfrage/i);
  assert.match(guide, /Geht es bei dir eher um Termine, Support oder interne Prozesse\?/i);
});

test('conversation guide can branch into an explicit custom state before contact-ready', () => {
  const guide = buildConversationGuide(
    [
      { role: 'assistant', content: 'Hi! Wie kann ich helfen?' },
      { role: 'user', content: 'wir brauchen support fuer viele standardfragen im shop' },
    ],
    {
      triggers: {
        qualifiedNeed: ['support', 'standardfragen'],
        industry: ['shop'],
      },
      states: [
        {
          id: 'support-branch',
          label: 'Support-Zweig',
          instruction: 'Du bist jetzt im Support-Zweig. Frage gezielt nach Ticketvolumen.',
          preferredQuestion: 'Wie viele wiederkehrende Supportanfragen habt ihr aktuell pro Woche?',
          requires: ['qualifiedNeed', 'industry'],
          matchAny: ['support', 'standardfragen'],
          forbids: ['contactIntent'],
        },
        {
          id: 'clarify',
          label: 'Einstieg',
          instruction: 'Klaere den Einstieg zuerst.',
          preferredQuestion: 'Worum geht es genau?',
        },
      ],
    },
  );

  assert.match(guide, /Gesprächsphase: support-branch/);
  assert.match(guide, /Support-Zweig/);
  assert.match(guide, /Wie viele wiederkehrende Supportanfragen habt ihr aktuell pro Woche\?/);
});

test('conversation guide resolves affirmation after a contact CTA through explicit states', () => {
  const guide = buildConversationGuide(
    [
      { role: 'assistant', content: 'Das klingt passend. Möchtest du lieber einen Termin oder direkt eine Anfrage schicken?' },
      { role: 'user', content: 'ja bitte' },
    ],
    {
      states: [
        {
          id: 'contact-ready',
          label: 'Kontaktbereit',
          instruction: 'Leite direkt in die Kontaktaufnahme weiter.',
          requiresAny: ['contactIntent', 'affirmedContactCta'],
        },
        {
          id: 'clarify',
          label: 'Einstieg',
          instruction: 'Klaere den Einstieg zuerst.',
          preferredQuestion: 'Worum geht es genau?',
        },
      ],
    },
  );

  assert.match(guide, /Gesprächsphase: contact-ready/);
  assert.match(guide, /direkt in die Kontaktaufnahme weiter/i);
});
