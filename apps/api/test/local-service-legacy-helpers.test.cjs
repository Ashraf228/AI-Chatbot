const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildLocalServiceMissingFieldsQuestion,
  buildLocalServiceMissingNotice,
  getLocalServiceFieldLabel,
  getMissingLocalServiceContactFields,
  hasCompleteLocalServiceAddress,
  hasLocalServiceFullName,
  hasPartialLocalServiceAddress,
  isValidLocalServicePhoneNumber,
} = require('../dist/chat/local-service-legacy.helpers.js');
const { DEFAULT_LOCAL_SERVICE_INTAKE_FLOW } = require('../dist/site-modules/module-configs.js');

const FULL_TEST_ADDRESS = 'Musterstraße 12, 60311 Frankfurt';

test('local service helper detects missing fields in legacy order', () => {
  assert.deepEqual(getMissingLocalServiceContactFields({}), [
    'concern',
    'urgency',
    'location',
    'name',
    'contact',
  ]);
  assert.deepEqual(getMissingLocalServiceContactFields({ concern: 'Klo verstopft' }), [
    'urgency',
    'location',
    'name',
    'contact',
  ]);
  assert.deepEqual(
    getMissingLocalServiceContactFields({
      concern: 'Klo verstopft',
      urgency: 'akut',
      location: FULL_TEST_ADDRESS,
      name: 'Max Mustermann',
      phone: '015511410215',
    }),
    [],
  );
});

test('local service helper keeps field labels stable', () => {
  assert.equal(getLocalServiceFieldLabel('concern'), 'Problem oder Anliegen');
  assert.equal(getLocalServiceFieldLabel('urgency'), 'Dringlichkeit');
  assert.equal(getLocalServiceFieldLabel('location'), 'vollständige Einsatzadresse');
  assert.equal(getLocalServiceFieldLabel('name'), 'Vor- und Nachname');
  assert.equal(getLocalServiceFieldLabel('contact'), 'Telefonnummer');
  assert.equal(buildLocalServiceMissingNotice(['location']), 'Für die Anfrage fehlt noch: vollständige Einsatzadresse.');
});

test('local service helper keeps missing-field prompts stable', () => {
  assert.equal(
    buildLocalServiceMissingFieldsQuestion({
      missing: ['concern'],
      scheduleIntent: false,
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    }),
    'Für die Anfrage fehlt noch: Problem oder Anliegen. Was genau ist betroffen - Toilette, Abfluss, Keller oder Kanal?',
  );
  assert.equal(
    buildLocalServiceMissingFieldsQuestion({
      missing: ['urgency'],
      scheduleIntent: false,
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    }),
    'Für die Anfrage fehlt noch: Dringlichkeit. Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?',
  );
  assert.equal(
    buildLocalServiceMissingFieldsQuestion({
      missing: ['location'],
      scheduleIntent: false,
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
      lastMessage: '65549',
    }),
    'Die PLZ allein reicht noch nicht. Bitte nennen Sie noch Straße, Hausnummer und Ort der Einsatzadresse.',
  );
  assert.equal(
    buildLocalServiceMissingFieldsQuestion({
      missing: ['name'],
      scheduleIntent: false,
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
      contact: { name: 'Müller' },
      lastMessage: 'Müller',
    }),
    'Für die Anfrage fehlt noch: Vor- und Nachname. Ein einzelner Name reicht noch nicht. Bitte nennen Sie uns Ihren Vor- und Nachnamen.',
  );
  assert.equal(
    buildLocalServiceMissingFieldsQuestion({
      missing: ['contact'],
      scheduleIntent: false,
      intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
      lastMessage: '36 76355',
    }),
    'Die Telefonnummer wirkt unvollständig oder ist keine gültige Rückrufnummer. Unter welcher Telefonnummer kann der Notdienst Sie zurückrufen?',
  );
});

test('local service helper validates address, phone and full name like the legacy flow', () => {
  assert.equal(hasCompleteLocalServiceAddress(FULL_TEST_ADDRESS), true);
  assert.equal(hasCompleteLocalServiceAddress('65549'), false);
  assert.equal(hasPartialLocalServiceAddress('65549'), true);
  assert.equal(isValidLocalServicePhoneNumber('015511410215'), true);
  assert.equal(isValidLocalServicePhoneNumber('36 76355'), false);
  assert.equal(hasLocalServiceFullName('Müller'), false);
  assert.equal(hasLocalServiceFullName('Max Müller'), true);
});

test('local service helper stays pure and has no side-effect dependencies', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/local-service-legacy.helpers.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
});
