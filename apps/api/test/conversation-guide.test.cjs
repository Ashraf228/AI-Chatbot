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
