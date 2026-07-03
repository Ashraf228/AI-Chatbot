const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLegacyRoutingMode,
  hasOnlyGenericEnabledTasks,
  hasOnlyGenericRequiredFields,
  isExplicitLegacyLocalServiceConfig,
  isExplicitLocalServiceIntakeFlow,
  isUniversalAssistantConfig,
} = require('../dist/chat/legacy-routing.guard.js');

const LOCAL_SERVICE_FLOW = {
  templateKey: 'local-service-first-contact',
  requiredFields: ['problem', 'urgency', 'fullAddress', 'phone'],
  questionOrder: ['problem', 'fullAddress', 'urgency', 'phone'],
  questionTexts: {
    problem: 'Was genau ist betroffen?',
    fullAddress: 'Bitte nennen Sie die vollständige Einsatzadresse.',
    urgency: 'Wie dringend ist es?',
  },
};

test('generic and universal markers stay universal', () => {
  assert.equal(getLegacyRoutingMode({ industry: 'generic' }), 'universal');
  assert.equal(getLegacyRoutingMode({ botType: 'universal-assistant' }), 'universal');
  assert.equal(
    getLegacyRoutingMode({ assistantProfile: { profileKey: 'universal-assistant' } }),
    'universal',
  );
  assert.equal(isUniversalAssistantConfig({ industry: undefined, botType: null }), true);
});

test('generic required fields and enabled tasks are not local-service markers', () => {
  const requiredFields = ['name', 'email', 'phone', 'request'];
  const enabledTasks = ['answer_questions', 'collect_requests'];

  assert.equal(hasOnlyGenericRequiredFields(requiredFields), true);
  assert.equal(hasOnlyGenericEnabledTasks(enabledTasks), true);
  assert.equal(getLegacyRoutingMode({ requiredFields }), 'universal');
  assert.equal(getLegacyRoutingMode({ enabledTasks }), 'universal');
  assert.equal(getLegacyRoutingMode({ leadCaptureEnabled: true }), 'universal');
});

test('explicit local-service markers route to local service legacy', () => {
  assert.equal(getLegacyRoutingMode({ botType: 'handwerker-first-contact' }), 'local_service_legacy');
  assert.equal(getLegacyRoutingMode({ industry: 'local-services' }), 'local_service_legacy');
  assert.equal(getLegacyRoutingMode({ industry: 'local-service-first-contact' }), 'local_service_legacy');
  assert.equal(getLegacyRoutingMode({ templateId: 'local-service-first-contact' }), 'local_service_legacy');
  assert.equal(
    getLegacyRoutingMode({ assistantProfile: { profileKey: 'local-service-first-contact' } }),
    'local_service_legacy',
  );
  assert.equal(getLegacyRoutingMode({ leadSalesIntakeFlow: LOCAL_SERVICE_FLOW }), 'local_service_legacy');
});

test('local-service intake flow requires explicit marker or local-service shape', () => {
  assert.equal(isExplicitLocalServiceIntakeFlow(LOCAL_SERVICE_FLOW), true);
  assert.equal(
    isExplicitLocalServiceIntakeFlow({
      requiredFields: ['name', 'email', 'phone', 'request'],
      questionOrder: ['name', 'email', 'phone', 'request'],
    }),
    false,
  );
  assert.equal(
    isExplicitLocalServiceIntakeFlow({
      requiredFields: ['problem', 'phone'],
      questionOrder: ['problem', 'phone'],
      questionTexts: { problem: 'Worum geht es?' },
    }),
    false,
  );
});

test('mixed universal inputs do not become local-service without explicit local marker', () => {
  assert.equal(
    getLegacyRoutingMode({
      industry: 'generic',
      conversationFlow: {
        requiredFields: ['name', 'email', 'phone', 'request'],
        questionOrder: ['name', 'email', 'phone', 'request'],
      },
    }),
    'universal',
  );
  assert.equal(
    getLegacyRoutingMode({
      botType: 'universal-assistant',
      requiredFields: ['phone'],
    }),
    'universal',
  );
  assert.equal(
    getLegacyRoutingMode({
      assistantProfile: { profileKey: 'universal-assistant' },
      conversationFlow: {
        requiredFields: ['problem', 'phone'],
        questionOrder: ['problem', 'phone'],
      },
    }),
    'universal',
  );
});

test('explicit local-service profile wins over generic fallback', () => {
  assert.equal(
    isExplicitLegacyLocalServiceConfig({
      industry: 'generic',
      botType: 'universal-assistant',
      assistantProfile: { profileKey: 'local-service-first-contact' },
    }),
    true,
  );
  assert.equal(
    getLegacyRoutingMode({
      industry: 'generic',
      botType: 'universal-assistant',
      assistantProfile: { profileKey: 'local-service-first-contact' },
    }),
    'local_service_legacy',
  );
});
