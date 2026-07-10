const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildAllowCreateEmailJobDedupeDecision,
  buildBlockedEmailJobDedupeDecision,
  buildContactRequestIdempotencyCandidate,
  buildContactRequestIdempotencyPolicy,
  buildConversationDeliveryIdempotencyCandidate,
  buildEmailJobBackfillRisk,
  buildFailedEmailJobDedupeDecision,
  buildGenericEmailDeliveryIdempotencyCandidate,
  buildGenericEmailDeliveryIdempotencyPolicy,
  buildLeadNotificationIdempotencyCandidate,
  buildLeadNotificationIdempotencyPolicy,
  buildProposedBackfillPlan,
  buildProposedDuplicateCleanupPlan,
  buildProposedIdempotencyColumnPlan,
  buildProposedPartialUniqueIndexPlan,
  buildReportDeliveryIdempotencyCandidate,
  buildReportDeliveryIdempotencyPolicy,
  buildSafeEmailJobBackfillRiskForLog,
  buildSafeEmailJobDedupeDecisionForAudit,
  buildSafeEmailJobDedupeDecisionForLog,
  buildSafeEmailJobIdempotencyCandidateForLog,
  buildSafeEmailJobIdempotencyPolicyForLog,
  buildSafeEmailJobSchemaPlanForLog,
  buildSkipDuplicateEmailJobDedupeDecision,
  isAllowCreateEmailJobDedupeDecision,
  isBlockedEmailJobDedupeDecision,
  isFailedEmailJobDedupeDecision,
  isSkipDuplicateEmailJobDedupeDecision,
  validateEmailJobBackfillRisk,
  validateEmailJobDedupeDecision,
  validateEmailJobIdempotencyCandidate,
  validateEmailJobIdempotencyKeyPolicy,
  validateEmailJobSchemaPlan,
} = require('../dist/chat/email-job-idempotency.boundary.js');

const RECIPIENT_HASH = 'sha256:abcdef1234567890fedcba0987654321';

test('email job idempotency boundary builds valid source-specific candidates', () => {
  const lead = buildLeadNotificationIdempotencyCandidate({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    leadId: 'lead-1',
    recipientHash: RECIPIENT_HASH,
    notificationType: 'internal_lead_notification',
  });
  const contact = buildContactRequestIdempotencyCandidate({
    siteId: 'site-1',
    contactRequestId: 'contact-request-1',
    recipientFingerprint: RECIPIENT_HASH,
    notificationType: 'contact_request_notification',
  });
  const conversation = buildConversationDeliveryIdempotencyCandidate({
    siteId: 'site-1',
    conversationId: 'conversation-1',
    sessionId: 'session-1',
    recipientIdentity: { type: 'recipient_hash', value: RECIPIENT_HASH },
    deliveryType: 'email',
  });
  const report = buildReportDeliveryIdempotencyCandidate({
    reportRunId: 'report-run-1',
    recipientHash: RECIPIENT_HASH,
    deliveryType: 'scheduled_report_email',
  });
  const generic = buildGenericEmailDeliveryIdempotencyCandidate({
    siteId: 'site-1',
    recipientHash: RECIPIENT_HASH,
    deliveryType: 'generic_email',
  });

  assert.equal(lead.type, 'email_job_idempotency_key_candidate');
  assert.equal(lead.version, 'v1');
  assert.equal(lead.sourceType, 'lead_notification');
  assert.equal(lead.parts.recipient.type, 'recipient_hash');
  assert.equal(lead.parts.recipient.value, RECIPIENT_HASH);
  assert.deepEqual(validateEmailJobIdempotencyCandidate(lead), {
    valid: true,
    reasonCode: 'lead_notification_idempotency_candidate',
  });

  for (const candidate of [contact, conversation, report, generic]) {
    assert.equal(validateEmailJobIdempotencyCandidate(candidate).valid, true);
  }
});

test('email job idempotency boundary blocks missing required parts and unknown source types', () => {
  const missingLeadId = buildLeadNotificationIdempotencyCandidate({
    siteId: 'site-1',
    recipientHash: RECIPIENT_HASH,
    notificationType: 'internal_lead_notification',
  });
  const missingRecipient = buildReportDeliveryIdempotencyCandidate({
    reportRunId: 'report-run-1',
    deliveryType: 'scheduled_report_email',
  });
  const unknownSource = {
    ...buildLeadNotificationIdempotencyCandidate({
      siteId: 'site-1',
      leadId: 'lead-1',
      recipientHash: RECIPIENT_HASH,
      notificationType: 'internal_lead_notification',
    }),
    sourceType: 'unsupported_source_delivery',
  };

  assert.deepEqual(validateEmailJobIdempotencyCandidate(missingLeadId), {
    valid: false,
    reasonCode: 'missing_leadId',
    errorCode: 'missing_required_part',
  });
  assert.deepEqual(validateEmailJobIdempotencyCandidate(missingRecipient), {
    valid: false,
    reasonCode: 'missing_email_job_recipient_hash',
    errorCode: 'missing_recipient_hash',
  });
  assert.deepEqual(validateEmailJobIdempotencyCandidate(unknownSource), {
    valid: false,
    reasonCode: 'invalid_email_job_idempotency_source_type',
    errorCode: 'invalid_source_type',
  });
});

test('email job idempotency boundary never carries raw recipient email into candidates', () => {
  const candidate = buildLeadNotificationIdempotencyCandidate({
    siteId: 'site-1',
    leadId: 'lead-1',
    recipientEmail: 'person@example.test',
    notificationType: 'internal_lead_notification',
  });

  assert.equal(JSON.stringify(candidate).includes('person@example.test'), false);
  assert.equal(candidate.parts.recipient.type, 'missing_recipient');
  assert.deepEqual(validateEmailJobIdempotencyCandidate(candidate), {
    valid: false,
    reasonCode: 'missing_email_job_recipient_hash',
    errorCode: 'missing_recipient_hash',
  });
});

test('email job idempotency policies require hashed recipient identity and expected source parts', () => {
  const leadPolicy = buildLeadNotificationIdempotencyPolicy();
  const contactPolicy = buildContactRequestIdempotencyPolicy();
  const reportPolicy = buildReportDeliveryIdempotencyPolicy();
  const genericPolicy = buildGenericEmailDeliveryIdempotencyPolicy();

  assert.deepEqual(leadPolicy.requiredParts, ['siteId', 'leadId', 'recipientHash', 'notificationType']);
  assert.deepEqual(contactPolicy.requiredParts, ['siteId', 'contactRequestId', 'recipientHash', 'notificationType']);
  assert.deepEqual(reportPolicy.requiredParts, ['reportRunId', 'recipientHash', 'deliveryType']);
  assert.deepEqual(genericPolicy.requiredParts, ['siteId', 'recipientHash', 'deliveryType']);
  for (const policy of [leadPolicy, contactPolicy, reportPolicy, genericPolicy]) {
    assert.equal(policy.piiMode, 'hashed_recipient_only');
    assert.equal(policy.allowsRawRecipientEmail, false);
    assert.equal(validateEmailJobIdempotencyKeyPolicy(policy).valid, true);
  }

  assert.deepEqual(validateEmailJobIdempotencyKeyPolicy({
    ...leadPolicy,
    allowsRawRecipientEmail: true,
  }), {
    valid: false,
    reasonCode: 'raw_recipient_not_allowed',
    errorCode: 'raw_recipient_not_allowed',
  });
});

test('email job idempotency boundary builds stable dedupe decision data objects only', () => {
  const candidate = buildReportDeliveryIdempotencyCandidate({
    reportRunId: 'report-run-1',
    recipientHash: RECIPIENT_HASH,
    deliveryType: 'scheduled_report_email',
  });
  const allow = buildAllowCreateEmailJobDedupeDecision(candidate);
  const duplicate = buildSkipDuplicateEmailJobDedupeDecision('already_queued', 'queued');
  const blocked = buildBlockedEmailJobDedupeDecision('missing_key', 'missing_required_part');
  const failed = buildFailedEmailJobDedupeDecision('projection_failed', 'invalid_candidate', true);

  assert.equal(isAllowCreateEmailJobDedupeDecision(allow), true);
  assert.equal(isSkipDuplicateEmailJobDedupeDecision(duplicate), true);
  assert.equal(isBlockedEmailJobDedupeDecision(blocked), true);
  assert.equal(isFailedEmailJobDedupeDecision(failed), true);
  assert.equal(validateEmailJobDedupeDecision(allow).valid, true);
  assert.deepEqual(duplicate, {
    decision: 'skip_duplicate',
    reasonCode: 'already_queued',
    duplicateStatus: 'queued',
  });
  assert.deepEqual(blocked, {
    decision: 'blocked',
    reasonCode: 'missing_key',
    errorCode: 'missing_required_part',
  });
  assert.deepEqual(failed, {
    decision: 'failed',
    reasonCode: 'projection_failed',
    errorCode: 'invalid_candidate',
    retryable: true,
  });
});

test('email job idempotency boundary models schema plans and backfill risk as proposed-only data', () => {
  const column = buildProposedIdempotencyColumnPlan('candidate_column_only');
  const unique = buildProposedPartialUniqueIndexPlan('candidate_unique_index_only');
  const backfill = buildProposedBackfillPlan('candidate_backfill_only');
  const cleanup = buildProposedDuplicateCleanupPlan('candidate_cleanup_only');
  const risk = buildEmailJobBackfillRisk({
    riskLevel: 'blocked',
    reasonCode: 'existing_duplicate_audit_required',
    requiresDbAudit: true,
    requiresDuplicateCleanup: true,
    requiresRollbackPlan: true,
  });

  for (const plan of [column, unique, backfill, cleanup]) {
    assert.equal(plan.status, 'proposed_only');
    assert.equal(validateEmailJobSchemaPlan(plan).valid, true);
    assert.equal(JSON.stringify(plan).includes('CREATE INDEX'), false);
    assert.equal(JSON.stringify(plan).includes('ALTER TABLE'), false);
  }
  assert.deepEqual(risk, {
    type: 'email_job_backfill_risk',
    riskLevel: 'blocked',
    reasonCode: 'existing_duplicate_audit_required',
    requiresDbAudit: true,
    requiresDuplicateCleanup: true,
    requiresRollbackPlan: true,
  });
  assert.equal(validateEmailJobBackfillRisk(risk).valid, true);
});

test('email job idempotency safe projections redact recipient and secret material without mutation', () => {
  const input = Object.freeze({
    siteId: 'site-1',
    leadId: 'lead-1',
    recipientHash: RECIPIENT_HASH,
    recipientEmail: 'person@example.test',
    notificationType: 'lead',
  });
  const candidate = buildLeadNotificationIdempotencyCandidate(input);
  const allow = buildAllowCreateEmailJobDedupeDecision(candidate);
  const unsafeDecision = {
    ...allow,
    candidate: {
      ...candidate,
      subject: 'Full subject should not appear',
      html: '<p>Full body should not appear</p>',
      token: 'dummy-token-secret',
      authorization: 'Bearer dummy-token-secret',
    },
  };

  const candidateLog = buildSafeEmailJobIdempotencyCandidateForLog(candidate);
  const policyLog = buildSafeEmailJobIdempotencyPolicyForLog(buildLeadNotificationIdempotencyPolicy());
  const decisionLog = buildSafeEmailJobDedupeDecisionForLog(unsafeDecision);
  const decisionAudit = buildSafeEmailJobDedupeDecisionForAudit(unsafeDecision);
  const schemaLog = buildSafeEmailJobSchemaPlanForLog(buildProposedIdempotencyColumnPlan('schema_plan'));
  const riskLog = buildSafeEmailJobBackfillRiskForLog(buildEmailJobBackfillRisk({ riskLevel: 'high' }));
  const serialized = JSON.stringify({
    candidateLog,
    policyLog,
    decisionLog,
    decisionAudit,
    schemaLog,
    riskLog,
  });

  assert.equal(serialized.includes(RECIPIENT_HASH), false);
  assert.equal(serialized.includes('abcdef1234567890'), false);
  assert.equal(serialized.includes('person@example.test'), false);
  assert.equal(serialized.includes('dummy-token-secret'), false);
  assert.equal(serialized.includes('Full subject should not appear'), false);
  assert.equal(serialized.includes('Full body should not appear'), false);
  assert.match(candidateLog.parts.recipient.value, /^sha256\.\.\./);
  assert.deepEqual(input, {
    siteId: 'site-1',
    leadId: 'lead-1',
    recipientHash: RECIPIENT_HASH,
    recipientEmail: 'person@example.test',
    notificationType: 'lead',
  });
});

test('email job idempotency boundary stays side-effect free and unwired', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-job-idempotency.boundary.ts'),
    'utf8',
  );
  const orchestrator = fs.readFileSync(
    path.join(__dirname, '../src/chat/chat-agent-orchestrator.service.ts'),
    'utf8',
  );
  const emailJobsService = fs.readFileSync(
    path.join(__dirname, '../src/modules/widget/services/email-jobs.service.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /^import\s/m);
  assert.doesNotMatch(source, /\basync\b|await\s|process\.env|console\.|Logger|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bCREATE\s+(TABLE|INDEX)\b/i);
  assert.doesNotMatch(source, /EmailJobsService|processPendingJobs|enqueue\(|report_runs|webhook_jobs|agent_tickets|widget_leads/);
  assert.doesNotMatch(source, /NOLIS|nolis|kommune|municipality/);
  assert.equal(orchestrator.includes('email-job-idempotency.boundary'), false);
  assert.equal(emailJobsService.includes('email-job-idempotency.boundary'), false);
});
