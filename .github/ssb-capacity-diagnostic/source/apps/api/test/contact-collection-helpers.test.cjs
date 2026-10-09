const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildContactMetadataPatch,
  buildPendingLeadPatch,
  buildPendingLeadState,
  extractContactDetails,
  extractName,
  extractPhoneNumber,
  getMissingContactFields,
  getMissingRequiredContactFields,
  getNextMissingContactField,
  hasLeadCaptureQuality,
  hasRequiredContactFields,
  mergeContactDetails,
  mergeContactFields,
} = require('../dist/chat/contact-collection.helpers.js');
const { DEFAULT_LOCAL_SERVICE_INTAKE_FLOW } = require('../dist/site-modules/module-configs.js');

test('contact helper extracts email, phone, name and concern like the legacy flow', () => {
  const contact = extractContactDetails(
    'Mein Name ist Max Mustermann, meine E-Mail ist max@example.com und ich brauche Beratung zur KI-Automatisierung.',
    null,
  );

  assert.equal(contact.email, 'max@example.com');
  assert.equal(contact.name, 'Max Mustermann');
  assert.equal(contact.concern, ', meine E-Mail ist und ich brauche Beratung zur KI-Automatisierung.');
  assert.equal(extractPhoneNumber('Bitte unter 0155 11410215 anrufen'), '0155 11410215');
  assert.equal(extractName('ich heiße Erika Musterfrau'), 'Erika Musterfrau');
});

test('contact helper keeps empty messages empty', () => {
  assert.deepEqual(extractContactDetails('', null), {
    name: undefined,
    email: undefined,
    phone: undefined,
    concern: undefined,
    location: undefined,
    urgency: undefined,
    preferredContact: undefined,
  });
});

test('contact helper does not treat local-service address-only answer as a name', () => {
  const contact = extractContactDetails(
    'Musterstraße 12, 65549 Limburg',
    { status: 'pending', concern: 'Keller läuft voll' },
    DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  );

  assert.equal(contact.name, undefined);
  assert.equal(contact.location, 'Musterstraße 12, 65549 Limburg');
});

test('contact helper detects missing generic contact fields', () => {
  assert.deepEqual(getMissingContactFields({}), ['concern', 'name', 'contact']);
  assert.deepEqual(getMissingContactFields({ concern: 'Beratung' }), ['name', 'contact']);
  assert.deepEqual(getMissingContactFields({ concern: 'Beratung', name: 'Max', email: 'max@example.com' }), []);
  assert.deepEqual(getMissingRequiredContactFields(['name', 'email', 'phone', 'request'], { name: 'Max' }), [
    'email',
    'phone',
    'concern',
  ]);
  assert.equal(hasRequiredContactFields(['name', 'email'], { name: 'Max', email: 'max@example.com' }), true);
  assert.equal(getNextMissingContactField(['name', 'contact'], { name: 'Max' }), 'contact');
});

test('contact helper merges without overwriting existing values with empty extracted fields', () => {
  const existing = {
    name: 'Max Mustermann',
    email: 'max@example.com',
    concern: 'KI Support',
  };
  const merged = mergeContactFields(existing, { phone: '015511410215', name: '' });

  assert.deepEqual(merged, {
    name: 'Max Mustermann',
    email: 'max@example.com',
    phone: '015511410215',
    concern: 'KI Support',
  });
  assert.deepEqual(mergeContactDetails({ status: 'pending', name: 'Max' }, { email: 'max@example.com' }), {
    name: 'Max',
    email: 'max@example.com',
    phone: undefined,
    concern: undefined,
    location: undefined,
    urgency: undefined,
    preferredContact: undefined,
  });
});

test('contact helper builds metadata patches without mutating inputs', () => {
  const previousState = Object.freeze({
    topic: 'KI Support',
    collectedFields: Object.freeze({ name: 'Max' }),
  });
  const previousLead = Object.freeze({
    status: 'pending',
    name: 'Max',
    leadPromptCount: 1,
    startedAt: '2026-01-01T00:00:00.000Z',
  });

  const metadataPatch = buildContactMetadataPatch(previousState, { email: 'max@example.com' });
  const leadPatch = buildPendingLeadPatch(previousLead, { email: 'max@example.com' });

  assert.equal(metadataPatch.collectedFields.name, 'Max');
  assert.equal(metadataPatch.collectedFields.email, 'max@example.com');
  assert.equal(leadPatch.name, 'Max');
  assert.equal(leadPatch.email, 'max@example.com');
  assert.equal(leadPatch.leadPromptCount, 2);
  assert.deepEqual(previousState.collectedFields, { name: 'Max' });
  assert.equal(previousLead.email, undefined);
});

test('contact helper preserves capture-ready behavior', () => {
  assert.equal(hasLeadCaptureQuality({ concern: 'Beratung', email: 'max@example.com' }), true);
  assert.equal(hasLeadCaptureQuality({ concern: 'Beratung', name: 'Max' }), false);
  assert.equal(hasLeadCaptureQuality({ email: 'max@example.com', name: 'Max' }), false);
  assert.equal(
    buildPendingLeadState({
      previous: null,
      contact: { concern: 'Beratung' },
      scheduleIntent: false,
      startedByIntent: 'lead',
    }).status,
    'pending',
  );
});

test('contact helper stays pure and has no side-effect dependencies', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/contact-collection.helpers.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
});
