import type {
  WebsiteAnswerPilotOperatorReadiness,
  WebsiteAnswerPilotOperatorReadinessObservabilityInput,
  WebsiteAnswerPilotOperatorReviewAudience,
} from './website-answer-pilot-operator-readiness';

export type WebsiteAnswerPilotOperatorReviewChecklistStatus =
  | 'internal_review_ready'
  | 'blocked'
  | 'needs_attention';

export type WebsiteAnswerPilotOperatorReviewChecklistItemId =
  | 'runtime_gate_passed'
  | 'answer_evaluation_passed'
  | 'retrieval_verified'
  | 'source_attribution_verified'
  | 'tenant_site_source_boundary_verified'
  | 'operator_readiness_internal_only'
  | 'public_widget_blocked'
  | 'production_live_blocked'
  | 'real_pilot_blocked'
  | 'customer_demo_blocked'
  | 'provider_live_blocked'
  | 'no_live_provider_calls'
  | 'no_live_llm_answers'
  | 'no_live_embeddings'
  | 'no_external_rag'
  | 'no_side_effects'
  | 'no_db_writes'
  | 'no_external_telemetry'
  | 'no_raw_content'
  | 'no_secrets'
  | 'no_approval_grants'
  | 'completion_unchanged'
  | 'runtime_readiness_unchanged';

export type WebsiteAnswerPilotOperatorReviewChecklistItemStatus =
  | 'pass'
  | 'blocked'
  | 'warning'
  | 'not_applicable';

export type WebsiteAnswerPilotOperatorReviewChecklistItemSeverity =
  | 'info'
  | 'warning'
  | 'blocker';

export type WebsiteAnswerPilotOperatorReviewChecklistItemCategory =
  | 'gate'
  | 'evaluation'
  | 'retrieval'
  | 'attribution'
  | 'audience'
  | 'boundary'
  | 'safety'
  | 'state';

export type WebsiteAnswerPilotOperatorReviewChecklistItem = {
  id: WebsiteAnswerPilotOperatorReviewChecklistItemId;
  label: string;
  status: WebsiteAnswerPilotOperatorReviewChecklistItemStatus;
  severity: WebsiteAnswerPilotOperatorReviewChecklistItemSeverity;
  category: WebsiteAnswerPilotOperatorReviewChecklistItemCategory;
  sanitizedMessage: string;
  evidence: Record<string, boolean | string | string[] | null>;
  nextAction: string;
};

export type WebsiteAnswerPilotOperatorReviewChecklist = {
  checklistVersion: '1';
  checklistStatus: WebsiteAnswerPilotOperatorReviewChecklistStatus;
  allowedFor: ['internal_operator_review'];
  notAllowedFor: [
    'public_widget',
    'production',
    'real_pilot',
    'customer_demo',
    'provider_live',
  ];
  items: WebsiteAnswerPilotOperatorReviewChecklistItem[];
  blockers: string[];
  warnings: string[];
  requiredBeforeCustomerDemo: string[];
  requiredBeforeProduction: string[];
  safety: {
    internalOnly: true;
    mockOnly: true;
    readOnly: true;
    nonPersistent: true;
    publicWidgetEnabled: false;
    productionEnabled: false;
    realPilotEnabled: false;
    noExternalTelemetry: true;
    noApprovalGrants: true;
    noRawContent: true;
    noSecrets: true;
    noCustomerData: true;
    noProductionData: true;
    noProvider: true;
    noLiveAnswer: true;
    noLiveEmbeddings: true;
    noRag: true;
    noSideEffects: true;
    noDbWrites: true;
    completionUnchanged: true;
    runtimeReadinessUnchanged: true;
  };
  internalOnly: true;
  mockOnly: true;
  readOnly: true;
  nonPersistent: true;
  publicWidgetEnabled: false;
  productionEnabled: false;
  realPilotEnabled: false;
};

export type WebsiteAnswerPilotOperatorReviewChecklistInput = {
  readiness: WebsiteAnswerPilotOperatorReadiness | null | undefined;
  observability:
    | WebsiteAnswerPilotOperatorReadinessObservabilityInput
    | null
    | undefined;
};

const NOT_ALLOWED_FOR: WebsiteAnswerPilotOperatorReviewChecklist['notAllowedFor'] = [
  'public_widget',
  'production',
  'real_pilot',
  'customer_demo',
  'provider_live',
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function hasOnlyInternalAudience(
  readiness: WebsiteAnswerPilotOperatorReadiness | null | undefined,
) {
  if (!readiness) {
    return false;
  }

  return (
    readiness.internalOnly === true &&
    readiness.mockOnly === true &&
    readiness.readOnly === true &&
    readiness.nonPersistent === true &&
    readiness.publicWidgetEnabled === false &&
    readiness.productionEnabled === false &&
    readiness.realPilotEnabled === false &&
    readiness.allowedFor.length === 1 &&
    readiness.allowedFor[0] === 'internal_operator_review' &&
    NOT_ALLOWED_FOR.every((audience) => readiness.notAllowedFor.includes(audience))
  );
}

function hasBlockedAudience(
  readiness: WebsiteAnswerPilotOperatorReadiness | null | undefined,
  audience: Exclude<WebsiteAnswerPilotOperatorReviewAudience, 'internal_operator_review'>,
) {
  if (!readiness) {
    return false;
  }
  return readiness.notAllowedFor.includes(audience);
}

function createEvidence(
  readiness: WebsiteAnswerPilotOperatorReadiness | null | undefined,
  observability:
    | WebsiteAnswerPilotOperatorReadinessObservabilityInput
    | null
    | undefined,
  extra: Record<string, boolean | string | string[] | null> = {},
) {
  return {
    readinessDecisionCode: readiness?.decisionCode ?? null,
    pilotDecisionCode: readiness?.evidence.pilotDecisionCode ?? observability?.decisionCode ?? null,
    gateDecisionCode: readiness?.evidence.gateDecisionCode ?? observability?.gate.decisionCode ?? null,
    answerEvaluationDecisionCode:
      readiness?.evidence.answerEvaluationDecisionCode ??
      observability?.answerEvaluation.decisionCode ??
      null,
    runtimeContext: readiness?.evidence.runtimeContext ?? observability?.runtimeContext ?? null,
    answerMode: readiness?.evidence.answerMode ?? observability?.answerMode ?? null,
    denialDecisionCodes:
      readiness?.evidence.denialDecisionCodes ?? observability?.denials.decisionCodes ?? [],
    missingChecks: readiness?.missingChecks ?? [],
    ...extra,
  };
}

function createItem(input: {
  id: WebsiteAnswerPilotOperatorReviewChecklistItemId;
  label: string;
  category: WebsiteAnswerPilotOperatorReviewChecklistItemCategory;
  passed: boolean;
  warning?: boolean;
  passMessage: string;
  blockedMessage: string;
  warningMessage?: string;
  nextAction: string;
  evidence: Record<string, boolean | string | string[] | null>;
}): WebsiteAnswerPilotOperatorReviewChecklistItem {
  if (input.passed) {
    return {
      id: input.id,
      label: input.label,
      status: 'pass',
      severity: 'info',
      category: input.category,
      sanitizedMessage: input.passMessage,
      evidence: input.evidence,
      nextAction: 'Keine weitere Aktion fuer diesen Checklist-Punkt erforderlich.',
    };
  }

  if (input.warning) {
    return {
      id: input.id,
      label: input.label,
      status: 'warning',
      severity: 'warning',
      category: input.category,
      sanitizedMessage: input.warningMessage || input.blockedMessage,
      evidence: input.evidence,
      nextAction: input.nextAction,
    };
  }

  return {
    id: input.id,
    label: input.label,
    status: 'blocked',
    severity: 'blocker',
    category: input.category,
    sanitizedMessage: input.blockedMessage,
    evidence: input.evidence,
    nextAction: input.nextAction,
  };
}

export function evaluateWebsiteAnswerPilotOperatorReviewChecklist(
  input: WebsiteAnswerPilotOperatorReviewChecklistInput,
): WebsiteAnswerPilotOperatorReviewChecklist {
  const readiness = input.readiness ?? null;
  const observability = input.observability ?? null;
  const missingObservability = !observability;
  const missingReadiness = !readiness;
  const warnings = unique([
    ...(readiness?.warnings ?? []),
    missingObservability ? 'missing_observability' : '',
    missingReadiness ? 'missing_operator_readiness' : '',
  ]);

  const items: WebsiteAnswerPilotOperatorReviewChecklistItem[] = [
    createItem({
      id: 'runtime_gate_passed',
      label: 'Runtime Gate erfolgreich ausgewertet',
      category: 'gate',
      passed: readiness?.requiredChecks.runtimeGate === true,
      passMessage: 'Das Runtime Gate ist fuer die interne Operator-Pruefung erfolgreich ausgewertet und erlaubt.',
      blockedMessage: 'Die interne Operator-Pruefung bleibt blockiert, bis ein erfolgreich ausgewertetes Runtime Gate vorliegt.',
      nextAction: 'Runtime Gate fuer den internen Mock-Only-Pfad mit verifizierter Evidenz erneut auswerten.',
      evidence: createEvidence(readiness, observability, {
        gateEvaluated: observability?.gate.evaluated ?? false,
        gateAllowed: observability?.gate.allowed ?? false,
      }),
    }),
    createItem({
      id: 'answer_evaluation_passed',
      label: 'Answer Evaluation erfolgreich',
      category: 'evaluation',
      passed: readiness?.requiredChecks.answerEvaluation === true,
      passMessage: 'Die Answer Evaluation ist erfolgreich und bleibt provider-frei.',
      blockedMessage: 'Die interne Operator-Pruefung verlangt eine erfolgreiche Answer Evaluation.',
      nextAction: 'Answer Evaluation mit verifizierter interner Mock-Evidenz erneut ausfuehren.',
      evidence: createEvidence(readiness, observability, {
        answered: observability?.answerEvaluation.answered ?? false,
        evaluated: observability?.answerEvaluation.evaluated ?? false,
      }),
    }),
    createItem({
      id: 'retrieval_verified',
      label: 'Retrieval verifiziert',
      category: 'retrieval',
      passed: readiness?.requiredChecks.retrieval === true,
      passMessage: 'Das Retrieval ist verifiziert und verwendet eine ready/indexed Quelle.',
      blockedMessage: 'Die interne Operator-Pruefung verlangt verifiziertes Retrieval aus einer ready/indexed Quelle.',
      nextAction: 'Retrieval-Verifikation und Ready-Source-Nachweis fuer die interne Mock-Pruefung ergaenzen.',
      evidence: createEvidence(readiness, observability, {
        retrievalVerified: observability?.retrieval.verified ?? false,
        usedReadySource: observability?.retrieval.usedReadySource ?? false,
        sourceCount: String(readiness?.evidence.sourceCount ?? observability?.retrieval.sourceCount ?? 0),
      }),
    }),
    createItem({
      id: 'source_attribution_verified',
      label: 'Source Attribution verifiziert',
      category: 'attribution',
      passed: readiness?.requiredChecks.sourceAttribution === true,
      passMessage: 'Die Source Attribution ist verifiziert und bleibt sanitisiert.',
      blockedMessage: 'Die interne Operator-Pruefung verlangt verifizierte Source Attribution ohne Raw Content.',
      nextAction: 'Source Attribution mit verifizierter Quellenreferenz erneut absichern.',
      evidence: createEvidence(readiness, observability, {
        sourceIds: readiness?.evidence.sourceIds ?? observability?.sourceAttribution.sourceIds ?? [],
        sourceAttributionVerified: observability?.sourceAttribution.verified ?? false,
      }),
    }),
    createItem({
      id: 'tenant_site_source_boundary_verified',
      label: 'Tenant/Site/Source Boundary verifiziert',
      category: 'boundary',
      passed: readiness?.requiredChecks.tenantSiteSourceBoundary === true,
      passMessage: 'Die Tenant-/Site-/Source-Boundary bleibt intakt.',
      blockedMessage: 'Cross-tenant-, cross-site- oder source-scope-Konflikte blockieren die interne Operator-Pruefung.',
      nextAction: 'Tenant-, Site- und Source-Scope-Evidenz fuer den Mock-Pfad bereinigen.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'operator_readiness_internal_only',
      label: 'Operator Readiness bleibt internal-only',
      category: 'audience',
      passed: hasOnlyInternalAudience(readiness),
      passMessage: 'Die Readiness erlaubt ausschliesslich internal_operator_review.',
      blockedMessage: 'Die Checklist darf nur aus einer internal-only, mock-only und read-only Readiness abgeleitet werden.',
      nextAction: 'Audience- und Safety-Boundaries wieder strikt auf internal_operator_review begrenzen.',
      evidence: createEvidence(readiness, observability, {
        allowedFor: readiness?.allowedFor ?? [],
        notAllowedFor: readiness?.notAllowedFor ?? [],
      }),
    }),
    createItem({
      id: 'public_widget_blocked',
      label: 'Public Widget bleibt blockiert',
      category: 'audience',
      passed: hasBlockedAudience(readiness, 'public_widget') && readiness?.publicWidgetEnabled === false,
      passMessage: 'Public Widget bleibt fuer die Operator-Review-Checklist blockiert.',
      blockedMessage: 'Die Checklist darf keine Public-Widget-Freigabe implizieren.',
      nextAction: 'Public-Widget-Boundary explizit blockiert halten.',
      evidence: createEvidence(readiness, observability, {
        publicWidgetEnabled: readiness?.publicWidgetEnabled ?? false,
        boundaryBlocked: observability?.boundaries.publicWidgetBlocked ?? null,
      }),
    }),
    createItem({
      id: 'production_live_blocked',
      label: 'Production/Life-Context bleibt blockiert',
      category: 'audience',
      passed: hasBlockedAudience(readiness, 'production') && readiness?.productionEnabled === false,
      passMessage: 'Production- und Live-Kontexte bleiben fuer diese Checklist blockiert.',
      blockedMessage: 'Die Checklist darf keine Production- oder Live-Freigabe implizieren.',
      nextAction: 'Production-Boundary strikt auf blocked belassen.',
      evidence: createEvidence(readiness, observability, {
        productionEnabled: readiness?.productionEnabled ?? false,
        boundaryBlocked: observability?.boundaries.productionBlocked ?? null,
      }),
    }),
    createItem({
      id: 'real_pilot_blocked',
      label: 'Real Pilot bleibt blockiert',
      category: 'audience',
      passed: hasBlockedAudience(readiness, 'real_pilot') && readiness?.realPilotEnabled === false,
      passMessage: 'Real-Pilot-Freigaben bleiben ausserhalb dieser Checklist blockiert.',
      blockedMessage: 'Die Checklist darf keinen Real-Pilot-Status freigeben.',
      nextAction: 'Real-Pilot-Boundary unveraendert blockiert halten.',
      evidence: createEvidence(readiness, observability, {
        realPilotEnabled: readiness?.realPilotEnabled ?? false,
      }),
    }),
    createItem({
      id: 'customer_demo_blocked',
      label: 'Customer Demo bleibt blockiert',
      category: 'audience',
      passed: hasBlockedAudience(readiness, 'customer_demo'),
      passMessage: 'Customer-Demo-Pfade bleiben blockiert.',
      blockedMessage: 'Die Checklist darf keinen Customer-Demo-Ready-Status erzeugen.',
      nextAction: 'Customer-Demo-Freigaben weiterhin separat und blockiert behandeln.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'provider_live_blocked',
      label: 'Provider-Live bleibt blockiert',
      category: 'audience',
      passed: hasBlockedAudience(readiness, 'provider_live') && readiness?.requiredChecks.noProvider === true,
      passMessage: 'Provider-Live bleibt fuer die Checklist vollstaendig blockiert.',
      blockedMessage: 'Die Checklist darf keine Provider-Live-Freigabe enthalten.',
      nextAction: 'Provider-Live-Modi weiterhin strikt blockieren.',
      evidence: createEvidence(readiness, observability, {
        answerMode: observability?.answerMode ?? null,
        providerLiveBlocked: observability?.boundaries.providerLiveBlocked ?? null,
      }),
    }),
    createItem({
      id: 'no_live_provider_calls',
      label: 'Keine Live-Provider-Calls',
      category: 'safety',
      passed: observability?.safety.noLiveProviderCalls === true,
      passMessage: 'Es werden keine Live-Provider-Calls verwendet.',
      blockedMessage: 'Die Checklist darf nur fuer provider-freie Mock-Pfade gelten.',
      nextAction: 'Provider-Aufrufe fuer diesen Pfad deaktiviert halten.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'no_live_llm_answers',
      label: 'Keine Live-LLM-Antworten',
      category: 'safety',
      passed: observability?.safety.noLiveLlmAnswers === true,
      passMessage: 'Es werden keine Live-LLM-Antworten erzeugt.',
      blockedMessage: 'Die Checklist darf keine Live-LLM-Antworten voraussetzen oder freigeben.',
      nextAction: 'Ausschliesslich Mock-Only-Antwortpfade verwenden.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'no_live_embeddings',
      label: 'Keine Live-Embeddings',
      category: 'safety',
      passed: observability?.safety.noLiveEmbeddings === true,
      passMessage: 'Es werden keine Live-Embeddings genutzt.',
      blockedMessage: 'Die Checklist darf keine Live-Embedding-Pfade einschliessen.',
      nextAction: 'Live-Embedding-Pfade weiterhin ausgeschlossen halten.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'no_external_rag',
      label: 'Kein externes RAG',
      category: 'safety',
      passed:
        observability?.safety.noRag === true &&
        observability?.boundaries.externalRagBlocked === true,
      passMessage: 'Externes RAG bleibt vollstaendig blockiert.',
      blockedMessage: 'Die Checklist darf kein externes RAG einschliessen.',
      nextAction: 'RAG-Pfade weiterhin blockiert und provider-frei halten.',
      evidence: createEvidence(readiness, observability, {
        externalRagBlocked: observability?.boundaries.externalRagBlocked ?? false,
      }),
    }),
    createItem({
      id: 'no_side_effects',
      label: 'Keine Side Effects',
      category: 'safety',
      passed:
        readiness?.requiredChecks.noSideEffects === true &&
        observability?.boundaries.sideEffectsBlocked === true,
      passMessage: 'Ticket-, Mail-, Webhook- und sonstige Side-Effect-Pfade bleiben blockiert.',
      blockedMessage: 'Die Checklist darf keinen Side-Effect-Pfad aktivieren.',
      nextAction: 'Side-Effect-Boundary unveraendert blockiert halten.',
      evidence: createEvidence(readiness, observability, {
        sideEffectsBlocked: observability?.boundaries.sideEffectsBlocked ?? false,
      }),
    }),
    createItem({
      id: 'no_db_writes',
      label: 'Keine DB Writes',
      category: 'safety',
      passed:
        observability?.boundaries.persistenceBlocked === true &&
        observability?.safety.noPersistence === true,
      passMessage: 'Es werden keine DB Writes oder sonstigen Persistenzpfade verwendet.',
      blockedMessage: 'Die Checklist darf nicht persistiert oder in die DB geschrieben werden.',
      nextAction: 'Checklist ausschliesslich in-memory und non-persistent halten.',
      evidence: createEvidence(readiness, observability, {
        persistenceBlocked: observability?.boundaries.persistenceBlocked ?? false,
      }),
    }),
    createItem({
      id: 'no_external_telemetry',
      label: 'Keine externe Telemetrie',
      category: 'safety',
      passed:
        observability?.boundaries.externalTelemetryBlocked === true &&
        observability?.safety.noExternalTelemetry === true,
      passMessage: 'Es wird keine externe Telemetrie verwendet.',
      blockedMessage: 'Die Checklist darf keine externe Telemetrie erzeugen.',
      nextAction: 'Externe Telemetrie fuer diesen Pfad deaktiviert halten.',
      evidence: createEvidence(readiness, observability, {
        externalTelemetryBlocked: observability?.boundaries.externalTelemetryBlocked ?? false,
      }),
    }),
    createItem({
      id: 'no_raw_content',
      label: 'Kein Raw Content',
      category: 'safety',
      passed: readiness?.requiredChecks.noRawContent === true,
      passMessage: 'Die Checklist bleibt frei von Raw Content und Raw Chunks.',
      blockedMessage: 'Die Checklist darf keinen Raw Content oder Raw Chunks enthalten.',
      nextAction: 'Nur sanitisierten Evidenz-Auszug in die Checklist uebernehmen.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'no_secrets',
      label: 'Keine Secrets oder Credentials',
      category: 'safety',
      passed: readiness?.requiredChecks.noSecrets === true,
      passMessage: 'Die Checklist bleibt frei von Secrets, Tokens, Passwoertern und Stack Traces.',
      blockedMessage: 'Die Checklist darf keine Secrets, Credentials, Tokens, Passwoerter oder Stack Traces enthalten.',
      nextAction: 'Nur sanitisierten Evidenz-Auszug ohne Secrets oder Stack Traces verwenden.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'no_approval_grants',
      label: 'Keine Approval Grants',
      category: 'safety',
      passed: observability?.safety.noApprovalGrants === true,
      passMessage: 'Es werden keine Approval Grants erzeugt oder behauptet.',
      blockedMessage: 'Die Checklist darf keine Approval Grants erzeugen oder suggerieren.',
      nextAction: 'Approval-Pfade weiterhin komplett ausserhalb dieses Tasks halten.',
      evidence: createEvidence(readiness, observability),
    }),
    createItem({
      id: 'completion_unchanged',
      label: 'Completion-Regeln unveraendert',
      category: 'state',
      passed: true,
      passMessage: 'Die Checklist veraendert keine Completion-Regeln.',
      blockedMessage: 'Die Checklist darf keine Completion-Regeln veraendern.',
      nextAction: 'Completion-Regeln ausserhalb dieses read-only Contracts belassen.',
      evidence: createEvidence(readiness, observability, {
        completionBoundary: 'unchanged',
      }),
    }),
    createItem({
      id: 'runtime_readiness_unchanged',
      label: 'Runtime Readiness unveraendert',
      category: 'state',
      passed: true,
      passMessage: 'Die Checklist veraendert keine Runtime-Readiness oder Go-Live-States.',
      blockedMessage: 'Die Checklist darf keine Runtime-Readiness- oder Go-Live-States veraendern.',
      nextAction: 'Runtime-Readiness ausschliesslich in bestehenden Gate-/Readiness-Pfaden belassen.',
      evidence: createEvidence(readiness, observability, {
        runtimeReadinessBoundary: 'unchanged',
      }),
    }),
  ];

  const blockedItems = items.filter((item) => item.status === 'blocked');
  const warningItems = items.filter((item) => item.status === 'warning');
  const checklistStatus: WebsiteAnswerPilotOperatorReviewChecklistStatus =
    blockedItems.length > 0 || readiness?.operatorReady === false || missingObservability || missingReadiness
      ? 'blocked'
      : readiness?.readinessLevel === 'needs_attention' || warningItems.length > 0 || warnings.length > 0
        ? 'needs_attention'
        : 'internal_review_ready';

  return {
    checklistVersion: '1',
    checklistStatus,
    allowedFor: ['internal_operator_review'],
    notAllowedFor: NOT_ALLOWED_FOR,
    items,
    blockers: unique([
      ...blockedItems.map((item) => item.id),
      ...(readiness?.blockers ?? []),
      missingObservability ? 'missing_observability' : '',
      missingReadiness ? 'missing_operator_readiness' : '',
    ]),
    warnings: unique([
      ...warningItems.map((item) => item.id),
      ...warnings,
    ]),
    requiredBeforeCustomerDemo: [
      'customer_demo remains blocked',
      'public_widget remains blocked',
      'provider_live remains blocked',
      'real_pilot remains blocked',
      'no customer or production approval is granted by this checklist',
    ],
    requiredBeforeProduction: [
      'production remains blocked',
      'public_widget remains blocked',
      'provider_live remains blocked',
      'real_pilot remains blocked',
      'no deploy or go-live approval is granted by this checklist',
    ],
    safety: {
      internalOnly: true,
      mockOnly: true,
      readOnly: true,
      nonPersistent: true,
      publicWidgetEnabled: false,
      productionEnabled: false,
      realPilotEnabled: false,
      noExternalTelemetry: true,
      noApprovalGrants: true,
      noRawContent: true,
      noSecrets: true,
      noCustomerData: true,
      noProductionData: true,
      noProvider: true,
      noLiveAnswer: true,
      noLiveEmbeddings: true,
      noRag: true,
      noSideEffects: true,
      noDbWrites: true,
      completionUnchanged: true,
      runtimeReadinessUnchanged: true,
    },
    internalOnly: true,
    mockOnly: true,
    readOnly: true,
    nonPersistent: true,
    publicWidgetEnabled: false,
    productionEnabled: false,
    realPilotEnabled: false,
  };
}
