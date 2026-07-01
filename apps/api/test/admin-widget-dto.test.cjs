require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');

const { UpdateWidgetConfigDto } = require('../dist/modules/widget/dto/admin-widget.dto.js');

function validateConfig(input) {
  const dto = plainToInstance(UpdateWidgetConfigDto, input);
  return validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
}

test('UpdateConfigDto accepts neutral universal assistant setup fields', () => {
  const errors = validateConfig({
    primaryGoal: 'lead_generation',
    setupGoal: 'lead_generation',
    industry: '',
    botType: 'universal-assistant',
    tone: 'professional',
    knowledgeMode: 'flexible',
    fallbackBehavior: 'ask_followup',
    ctaText: 'Anfrage aufnehmen',
    assistantProfile: {
      profileKey: 'universal-assistant',
      profileVersion: 1,
      assistantName: 'Musterkunde Assistent',
      role: 'Kundenservice-Mitarbeiter',
      businessDescription: '',
      targetUsers: [],
      tone: 'professional',
      answerStyle: 'concise',
      knowledgeMode: 'flexible',
    },
    enabledTasks: ['answer_questions', 'collect_requests', 'support', 'prepare_handoff'],
    conversationEngine: {
      previewEnabled: false,
      compareEnabled: false,
      responsePreviewEnabled: false,
      knowledgePreviewEnabled: false,
      adminTestOnly: true,
    },
  });

  assert.deepEqual(errors, []);
});

test('UpdateConfigDto keeps legacy handwerker bot type valid', () => {
  const errors = validateConfig({
    botType: 'handwerker-first-contact',
    industry: 'local-service-first-contact',
    tone: 'professional',
  });

  assert.deepEqual(errors, []);
});
