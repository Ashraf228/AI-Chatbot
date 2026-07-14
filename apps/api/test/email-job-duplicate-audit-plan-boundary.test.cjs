const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildAggregateOnlyDuplicateAuditPlan,
  buildBlockedCleanupPlan,
  buildBlockedEmailJobDuplicateAuditPlanResult,
  buildContactRequestDuplicateCandidate,
  buildConversationDeliveryDuplicateCandidate,
  buildEmailJobCleanupEligibilityPolicy,
  buildEmailJobDuplicateRiskGroup,
  buildEmailJobManualReviewDecision,
  buildFailedEmailJobDuplicateAuditPlanResult,
  buildLeadNotificationDuplicateCandidate,
  buildManualReviewOnlyCleanupPlan,
  buildManualReviewPackDuplicateAuditPlan,
  buildMetadataReportRunDuplicateCandidate,
  buildNoCleanupPlan,
  buildPiiSafeCandidateDuplicateAuditPlan,
  buildQueuedOnlyCandidateCleanupPlan,
  buildReadyEmailJobDuplicateAuditPlanResult,
  buildRecipientContentDuplicateCandidate,
  buildReportDeliveryDuplicateCandidate,
  buildSafeEmailJobCleanupEligibilityPolicyForLog,
  buildSafeEmailJobCleanupPlanForLog,
  buildSafeEmailJobDuplicateAuditPlanForLog,
  buildSafeEmailJobDuplicateAuditPlanResultForAudit,
  buildSafeEmailJobDuplicateAuditPlanResultForLog,
  buildSafeEmailJobDuplicateCandidateForLog,
  buildSafeEmailJobDuplicateRiskGroupForLog,
  buildSafeEmailJobManualReviewDecisionForLog,
  buildSentMarkOnlyCleanupPlan,
  buildSkippedEmailJobDuplicateAuditPlanResult,
  buildUnknownUntilDbAuditPlan,
  isBlockedEmailJobDuplicateAuditPlanResult,
  isFailedEmailJobDuplicateAuditPlanResult,
  isReadyEmailJobDuplicateAuditPlanResult,
  isSkippedEmailJobDuplicateAuditPlanResult,
  validateEmailJobCleanupEligibilityPolicy,
  validateEmailJobCleanupPlan,
  validateEmailJobDuplicateAuditPlan,
  validateEmailJobDuplicateAuditPlanItem,
  validateEmailJobDuplicateCandidate,
  validateEmailJobDuplicateRiskGroup,
  validateEmailJobManualReviewDecision,
} = require('../dist/chat/email-job-duplicate-audit-plan.boundary.js');

const RECIPIENT_HASH = 'sha256:abcdef1234567890fedcba0987654321';
const RECIPIENT_FINGERPRINT = 'fingerprint:1234567890abcdef';

test('email job duplicate audit plan boundary builds valid source-specific candidates', () => {
  const lead = buildLeadNotificationDuplicateCandidate({
    siteId: 'site-1',
    leadId: 'lead-1',
    recipientHash: RECIPIENT_HASH,
    notificationType: 'internal_lead_notification',
  });
  const contact = buildContactRequestDuplicateCandidate({
    siteId: 'site-1',
    contactRequestId: 'contact-request-1',
    recipientFingerprint: RECIPIENT_FINGERPRINT,
    notificationType: 'contact_request_notification',
  });
  const conversation = buildConversationDeliveryDuplicateCandidate({
    siteId: 'site-1',
    conversationId: 'conversation-1',
    sessionId: 'session-1',
    recipientIdentity: { type: 'recipient_hash', value: RECIPIENT_HASH },
    deliveryType: 'email',
  });
  const report = buildReportDeliveryDuplicateCandidate({
    reportRunId: 'report-run-1',
    recipientHash: RECIPIENT_HASH,
    deliveryType: 'scheduled_report_email',
  });
  const metadataRun = buildMetadataReportRunDuplicateCandidate({
    reportRunId: 'report-run-1',
    recipientFingerprint: RECIPIENT_FINGERPRINT,
  });

  for (const candidate of [lead, contact, conversation, report, metadataRun]) {
    assert.equal(validateEmailJobDuplicateCandidate(candidate).valid, true);
    assert.equal(candidate.type, 'email_job_duplicate_candidate');
    assert.equal(candidate.version, 'v1');
  }
});

test('email job duplicate audit plan boundary blocks missing ids and raw recipient input', () => {
  const missingLeadId = buildLeadNotificationDuplicateCandidate({
    siteId: 'site-1',
    recipientHash: RECIPIENT_HASH,
    notificationType: 'internal_lead_notification',
  });
  const missingRecipient = buildReportDeliveryDuplicateCandidate({
    reportRunId: 'report-run-1',
    deliveryType: 'scheduled_report_email',
  });
  const rawRecipient = buildContactRequestDuplicateCandidate({
    siteId: 'site-1',
    contactRequestId: 'contact-request-1',
    recipientEmail: 'person@example.test',
    notificationType: 'contact_request_notification',
  });

  assert.deepEqual(validateEmailJobDuplicateCandidate(missingLeadId), {
    valid: false,
    reasonCode: 'missing_leadId',
    errorCode: 'missing_required_part',
  });
  assert.deepEqual(validateEmailJobDuplicateCandidate(missingRecipient), {
    valid: false,
    reasonCode: 'missing_duplicate_recipient_identity',
    errorCode: 'missing_recipient_identity',
  });
  assert.deepEqual(validateEmailJobDuplicateCandidate(rawRecipient), {
    valid: false,
    reasonCode: 'raw_recipient_email_not_accepted',
    errorCode: 'raw_recipient_not_allowed',
  });
  assert.equal(JSON.stringify(rawRecipient).includes('person@example.test'), false);
});

test('email job duplicate audit plan boundary only accepts safe content fingerprints', () => {
  const valid = buildRecipientContentDuplicateCandidate({
    recipientHash: RECIPIENT_HASH,
    contentFingerprint: 'sha256_content_12345678',
  });
  const unsafe = buildRecipientContentDuplicateCandidate({
    recipientHash: RECIPIENT_HASH,
    contentFingerprint: '<p>body should not be used</p>',
  });

  assert.equal(validateEmailJobDuplicateCandidate(valid).valid, true);
  assert.deepEqual(validateEmailJobDuplicateCandidate(unsafe), {
    valid: false,
    reasonCode: 'missing_contentFingerprint',
    errorCode: 'missing_required_part',
  });
  assert.equal(JSON.stringify(unsafe).includes('<p>body should not be used</p>'), false);
});

test('email job duplicate risk groups classify duplicate cleanup risk by status', () => {
  const queued = buildEmailJobDuplicateRiskGroup('queued', 'lead_notification');
  const processing = buildEmailJobDuplicateRiskGroup('processing', 'lead_notification');
  const sent = buildEmailJobDuplicateRiskGroup('sent', 'report_delivery');
  const failed = buildEmailJobDuplicateRiskGroup('failed', 'conversation_delivery');
  const unknown = buildEmailJobDuplicateRiskGroup('unknown', 'unknown');

  assert.equal(queued.riskLevel, 'medium');
  assert.equal(processing.riskLevel, 'blocked');
  assert.equal(sent.riskLevel, 'blocked');
  assert.equal(failed.riskLevel, 'high');
  assert.equal(unknown.riskLevel, 'blocked');

  for (const group of [queued, processing, sent, failed, unknown]) {
    assert.equal(validateEmailJobDuplicateRiskGroup(group).valid, true);
    assert.equal(group.requiresManualReview, true);
  }
});

test('email job cleanup eligibility policies never allow auto cleanup', () => {
  const queued = buildEmailJobCleanupEligibilityPolicy('queued');
  const processing = buildEmailJobCleanupEligibilityPolicy('processing');
  const sent = buildEmailJobCleanupEligibilityPolicy('sent');
  const failed = buildEmailJobCleanupEligibilityPolicy('failed');
  const unknown = buildEmailJobCleanupEligibilityPolicy('unknown');

  assert.equal(queued.decision, 'manual_review_required');
  assert.equal(processing.decision, 'not_cleanup_eligible');
  assert.equal(sent.decision, 'not_cleanup_eligible');
  assert.equal(failed.decision, 'manual_review_required');
  assert.equal(unknown.decision, 'blocked');

  for (const policy of [queued, processing, sent, failed, unknown]) {
    assert.equal(policy.autoCleanupAllowed, false);
    assert.equal(validateEmailJobCleanupEligibilityPolicy(policy).valid, true);
  }
});

test('email job duplicate audit plans stay proposed-only and data-only', () => {
  const aggregate = buildAggregateOnlyDuplicateAuditPlan('aggregate_only');
  const piiSafe = buildPiiSafeCandidateDuplicateAuditPlan('pii_safe_candidates');
  const reviewPack = buildManualReviewPackDuplicateAuditPlan('manual_review_pack');
  const unknown = buildUnknownUntilDbAuditPlan('unknown_until_db_audit');
  const serialized = JSON.stringify([aggregate, piiSafe, reviewPack, unknown]);

  for (const plan of [aggregate, piiSafe, reviewPack, unknown]) {
    assert.equal(plan.status, 'proposed_only');
    assert.equal(plan.allowsRawRecipientEmail, false);
    assert.equal(validateEmailJobDuplicateAuditPlan(plan).valid, true);
  }
  assert.equal(serialized.includes('SELECT'), false);
  assert.equal(serialized.includes('INSERT'), false);
  assert.equal(serialized.includes('UPDATE'), false);
  assert.equal(serialized.includes('DELETE'), false);
});

test('email job cleanup plans remain proposed-only and non-destructive', () => {
  const noCleanup = buildNoCleanupPlan();
  const manual = buildManualReviewOnlyCleanupPlan();
  const queuedOnly = buildQueuedOnlyCandidateCleanupPlan();
  const sentMark = buildSentMarkOnlyCleanupPlan();
  const blocked = buildBlockedCleanupPlan();

  assert.equal(noCleanup.requiresBackup, false);
  assert.equal(noCleanup.requiresRollbackPlan, false);
  for (const plan of [noCleanup, manual, queuedOnly, sentMark, blocked]) {
    assert.equal(plan.status, 'proposed_only');
    assert.equal(plan.destructiveActionAllowed, false);
    assert.equal(validateEmailJobCleanupPlan(plan).valid, true);
  }
});

test('email job manual review decisions stay review-only and blocked for unknown status', () => {
  const sent = buildEmailJobManualReviewDecision('sent');
  const processing = buildEmailJobManualReviewDecision('processing');
  const failed = buildEmailJobManualReviewDecision('failed');
  const queued = buildEmailJobManualReviewDecision('queued');
  const unknown = buildEmailJobManualReviewDecision('unknown');

  assert.equal(sent.decision, 'review_required');
  assert.equal(processing.decision, 'review_required');
  assert.equal(failed.decision, 'review_required');
  assert.equal(queued.decision, 'review_required');
  assert.equal(unknown.decision, 'blocked');

  for (const decision of [sent, processing, failed, queued, unknown]) {
    assert.equal(validateEmailJobManualReviewDecision(decision).valid, true);
  }
});

test('email job duplicate audit plan results and classifiers are stable data objects', () => {
  const ready = buildReadyEmailJobDuplicateAuditPlanResult(buildNoCleanupPlan('no_cleanup'));
  const skipped = buildSkippedEmailJobDuplicateAuditPlanResult('not_in_scope');
  const blocked = buildBlockedEmailJobDuplicateAuditPlanResult('missing_duplicate_identity', 'missing_recipient_identity');
  const failed = buildFailedEmailJobDuplicateAuditPlanResult(
    'projection_failed',
    'unknown_email_job_duplicate_audit_plan_error',
    true,
  );

  assert.equal(isReadyEmailJobDuplicateAuditPlanResult(ready), true);
  assert.equal(isSkippedEmailJobDuplicateAuditPlanResult(skipped), true);
  assert.equal(isBlockedEmailJobDuplicateAuditPlanResult(blocked), true);
  assert.equal(isFailedEmailJobDuplicateAuditPlanResult(failed), true);
  assert.equal(validateEmailJobDuplicateAuditPlanItem(ready.plan).valid, true);
});

test('email job duplicate audit safe projections redact sensitive material without mutation', () => {
  const candidate = buildLeadNotificationDuplicateCandidate({
    siteId: 'site-1',
    leadId: 'lead-1',
    recipientHash: RECIPIENT_HASH,
    notificationType: 'internal',
  });
  const unsafe = Object.freeze({
    ...candidate,
    recipientEmail: 'person@example.test',
    subject: 'Full subject should not appear',
    html: '<p>Full body should not appear</p>',
    text: 'Full text should not appear',
    payload: { authorization: 'Bearer dummy-token-secret', apiKey: 'dummy-api-key' },
    signingSecret: 'dummy-signing-secret',
    last_error: 'provider failure detail',
  });
  const ready = buildReadyEmailJobDuplicateAuditPlanResult(unsafe);
  const projections = [
    buildSafeEmailJobDuplicateCandidateForLog(unsafe),
    buildSafeEmailJobDuplicateRiskGroupForLog(buildEmailJobDuplicateRiskGroup('queued', 'lead_notification')),
    buildSafeEmailJobCleanupEligibilityPolicyForLog(buildEmailJobCleanupEligibilityPolicy('queued')),
    buildSafeEmailJobDuplicateAuditPlanForLog(buildAggregateOnlyDuplicateAuditPlan()),
    buildSafeEmailJobCleanupPlanForLog(buildManualReviewOnlyCleanupPlan()),
    buildSafeEmailJobManualReviewDecisionForLog(buildEmailJobManualReviewDecision('sent')),
    buildSafeEmailJobDuplicateAuditPlanResultForLog(ready),
    buildSafeEmailJobDuplicateAuditPlanResultForAudit(ready),
  ];
  const serialized = JSON.stringify(projections);

  assert.equal(serialized.includes('person@example.test'), false);
  assert.equal(serialized.includes(RECIPIENT_HASH), false);
  assert.equal(serialized.includes('abcdef1234567890'), false);
  assert.equal(serialized.includes('Full subject should not appear'), false);
  assert.equal(serialized.includes('Full body should not appear'), false);
  assert.equal(serialized.includes('Full text should not appear'), false);
  assert.equal(serialized.includes('dummy-token-secret'), false);
  assert.equal(serialized.includes('dummy-api-key'), false);
  assert.equal(serialized.includes('dummy-signing-secret'), false);
  assert.equal(serialized.includes('provider failure detail'), false);
  assert.match(projections[0].parts.recipient.value, /^sha256/);
  assert.equal(unsafe.recipientEmail, 'person@example.test');
  assert.equal(unsafe.payload.authorization, 'Bearer dummy-token-secret');
});

test('email job duplicate audit plan boundary stays side-effect free and unwired', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/email-job-duplicate-audit-plan.boundary.ts'),
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
  assert.equal(orchestrator.includes('email-job-duplicate-audit-plan.boundary'), false);
  assert.equal(emailJobsService.includes('email-job-duplicate-audit-plan.boundary'), false);
});
