const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AssistantProfileResolverService,
} = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');

function resolve(input) {
  return new AssistantProfileResolverService().resolve(input);
}

test('legacy Handwerker site resolves to local-service-first-contact profile', () => {
  const profile = resolve({
    siteConfig: {
      botType: 'handwerker-first-contact',
      industry: 'local-service-first-contact',
      leadCaptureEnabled: true,
      leadNotificationEmail: 'lead@example.test',
    },
  });

  assert.equal(profile.profileKey, 'local-service-first-contact');
  assert.equal(profile.profileVersion, 1);
  assert.equal(profile.legacySource, 'botType');
  assert.deepEqual(
    profile.requiredFields.map((field) => field.key),
    ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'],
  );
  assert.equal(profile.deliveryChannels.email.enabled, true);
  assert.equal(profile.deliveryChannels.email.recipientEmail, 'lead@example.test');
});

test('lead-sales intakeFlow is preferred and mapped into required fields', () => {
  const profile = resolve({
    siteConfig: {
      leadCaptureEnabled: true,
      leadNotificationEmail: 'dispatch@example.test',
      conversationFlow: {
        requiredFields: ['legacyOnly'],
      },
    },
    moduleConfigs: {
      'lead-sales': {
        intakeFlow: {
          templateKey: 'local-service-first-contact',
          requiredFields: ['problem', 'phone'],
          questionOrder: ['problem', 'fullAddress', 'phone'],
          questionTexts: {
            problem: 'Was ist passiert?',
            fullAddress: 'Adresse?',
            phone: 'Telefon?',
          },
        },
      },
    },
  });

  assert.equal(profile.profileKey, 'local-service-first-contact');
  assert.equal(profile.legacySource, 'lead-sales.intakeFlow');
  assert.deepEqual(
    profile.requiredFields.map((field) => field.key),
    ['problem', 'fullAddress', 'phone'],
  );
  assert.equal(profile.requiredFields[0].question, 'Was ist passiert?');
  assert.equal(profile.deliveryChannels.email.recipientEmail, 'dispatch@example.test');
});

test('site conversationFlow is mapped when no module intakeFlow exists', () => {
  const profile = resolve({
    siteConfig: {
      leadCaptureEnabled: true,
      leadNotificationEmail: 'team@example.test',
      conversationFlow: {
        requiredFields: ['topic', 'email'],
        questionOrder: ['topic', 'email'],
        questionTexts: {
          topic: 'Worum geht es?',
          email: 'Welche E-Mail-Adresse?',
        },
      },
    },
  });

  assert.equal(profile.profileKey, 'universal-assistant');
  assert.equal(profile.legacySource, 'conversationFlow');
  assert.deepEqual(
    profile.requiredFields.map((field) => field.key),
    ['topic', 'email'],
  );
  assert.equal(profile.requiredFields[1].question, 'Welche E-Mail-Adresse?');
});

test('site without flow falls back to universal-assistant profile', () => {
  const profile = resolve({
    siteConfig: {
      leadCaptureEnabled: false,
    },
  });

  assert.equal(profile.profileKey, 'universal-assistant');
  assert.equal(profile.legacySource, 'default');
  assert.deepEqual(profile.requiredFields, []);
  assert.equal(profile.deliveryChannels.email.enabled, false);
});

test('resolver is idempotent and does not mutate source config', () => {
  const input = {
    siteConfig: {
      leadCaptureEnabled: true,
      leadNotificationEmail: 'idempotent@example.test',
      industry: 'local-services',
      conversationFlow: {
        requiredFields: ['problem', 'phone'],
        questionTexts: { phone: 'Telefon?' },
      },
    },
  };
  const before = JSON.stringify(input);
  const first = resolve(input);
  const second = resolve(input);

  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(first, second);
  assert.equal(first.deliveryChannels.email.recipientEmail, 'idempotent@example.test');
  assert.deepEqual(first.requiredFields.map((field) => field.key), ['problem', 'phone']);
});

test('new assistantProfile wins over legacy fields', () => {
  const profile = resolve({
    siteConfig: {
      botType: 'handwerker-first-contact',
      assistantProfile: {
        profileKey: 'support-assistant',
        profileVersion: 1,
        assistantName: 'Support Profil',
      },
    },
    moduleConfigs: {
      'lead-sales': null,
    },
  });

  assert.equal(profile.profileKey, 'support-assistant');
  assert.equal(profile.assistantName, 'Support Profil');
  assert.equal(profile.legacySource, 'assistantProfile');
});

test('stored assistant-profile module wins over site assistantProfile and legacy fields', () => {
  const profile = resolve({
    siteConfig: {
      botType: 'handwerker-first-contact',
      assistantProfile: {
        profileKey: 'support-assistant',
        profileVersion: 1,
        assistantName: 'Site Profil',
      },
    },
    moduleConfigs: {
      'assistant-profile': {
        assistantProfile: {
          profileKey: 'knowledge-assistant',
          profileVersion: 1,
          assistantName: 'Gespeichertes Profil',
        },
      },
      'lead-sales': {
        intakeFlow: {
          questionOrder: ['problem', 'phone'],
        },
      },
    },
  });

  assert.equal(profile.profileKey, 'knowledge-assistant');
  assert.equal(profile.assistantName, 'Gespeichertes Profil');
  assert.equal(profile.legacySource, 'assistantProfile');
});
