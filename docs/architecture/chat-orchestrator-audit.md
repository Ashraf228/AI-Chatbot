# Chat Orchestrator Audit

Datum: 2026-07-03
Scope: Read-only Audit von Live-Chat-Orchestrator, Chat-Pipeline, Routing, Conversation Guides, Legacy-Flows, AssistantProfile-Beobachtung und relevanten Tests.

## Summary

Der Live-Chat bleibt auf der Legacy-Pipeline. `ChatAgentOrchestratorService` ist aktuell der groesste Risiko- und Kopplungspunkt im Chat-Backend: ca. 3.400 Zeilen mit Routing, Lead Capture, Local-Service-Legacy, IT-Support-Tickets, Contact Collection, Metadata-State, Field Extraction, Antworttexten und Side Effects.

P1.1 hat die Config Source of Truth fuer neue Assistant-Konfigurationen verbessert. Die Live-Chat-Entscheidung nutzt das gespeicherte `AssistantProfile` aber noch nicht als primaere Entscheidungsquelle. Im Widget wird das Profil read-only beobachtet und geloggt; die Live-Antwortlogik bleibt Legacy.

Der naechste Refactor sollte daher nicht die Conversation Engine live schalten, sondern den bestehenden Orchestrator schrittweise modularisieren. Ziel ist gleiche Funktion, klarere Grenzen und bessere Tests vor jeder Verhaltensaenderung.

## Current Responsibilities

| Methode/Funktion | Verantwortung | Legacy | Universal | Side Effects | Risiko | Moegliche Zielklasse |
| --- | --- | --- | --- | --- | --- | --- |
| `decide` | Zentrale Live-Entscheidung, ruft Structured Decision, Module/Site Config, State, IT-Support, Lead/Contact Flow und Antworttexte zusammen | Ja | Ja | Ja | Sehr hoch | Orchestrator Facade |
| `createStructuredDecision` | Optionaler Agent Decision Orchestrator mit Fehler-Fallback | Nein | Ja | Log | Mittel | StructuredDecisionAdapter |
| `mapNonLeadStructuredDecision` | Uebersetzt AgentDecision in ChatAgentDecision | Nein | Ja | Nein | Mittel | ConversationResponsePolicyService |
| `handleItSupportFlow` | IT-Support Signal-, Ticket-, Confirmation- und Solution-Flow | Teilweise | Ja | Metadata, Ticket Tool | Hoch | ItSupportTicketFlowService |
| `collectItSupportTicketFields` | Pflichtfelder fuer IT-Ticket sammeln und Ready-State setzen | Nein | Ja | Metadata | Hoch | ItSupportTicketFlowService |
| `getModuleContext` | Liest site_modules fuer lead-sales und it-support | Ja | Ja | DB read | Mittel | ChatFlowContextService |
| `getSiteConfig` | Liest Site Config, Legacy-Signale, URLs, Lead-E-Mail und Local-Service-Fallbacks | Ja | Ja | DB read | Hoch | ChatFlowContextService / LegacyRoutingGuard |
| `captureLead` | Dedup und Insert in `widget_leads`, setzt Session Lead Status | Ja | Ja | `widget_leads`, `widget_sessions` | Hoch | LeadCaptureFlowService |
| `createContactRequest` | Insert in `agent_contact_requests` fuer Termin/Kontakt | Nein | Ja | `agent_contact_requests` | Hoch | HandoffPreparationService |
| `loadConversationMetadata` | Liest `pendingLead`, `pendingTicket`, `conversationState` aus Conversation metadata | Ja | Ja | DB read | Mittel | ConversationMetadataStateService |
| `saveConversationMetadata` | Patcht Conversation metadata und `last_active_at` | Ja | Ja | `conversations.metadata` | Hoch | ConversationMetadataStateService |
| `recordLeadAudit` | Audit fuer Lead-/Schedule-State | Ja | Ja | `audit_logs` | Mittel | LeadCaptureFlowService |
| `queueInternalLeadNotification` | Baut Lead-Mail und queued `email_jobs` | Ja | Ja | `email_jobs`, Log | Hoch | LeadNotificationService / HandoffPreparationService |
| `isLocalServiceFlow` und Local-Service Guards | Entscheiden, ob lokale Dienstleisterlogik aktiv wird | Ja | Nein | Nein | Hoch | LegacyRoutingGuard |
| `isExplicitLocalServiceSiteConfig` | Erkennt explizite Legacy-Site-Signale aus Config | Ja | Nein | Nein | Hoch | LegacyRoutingGuard |
| `isExplicitLocalServiceIntakeFlow` | Erkennt Local-Service-Intake anhand Shape/Keys | Ja | Nein | Nein | Hoch | LegacyRoutingGuard |
| `extractContactDetails` | Extrahiert Name, E-Mail, Telefon, Anliegen, Ort, Dringlichkeit | Ja | Ja | Nein | Hoch | FieldExtractionService |
| `extractServiceLocation`, `extractFullServiceAddress`, `extractServiceUrgency` | Local-Service-spezifische Felder | Ja | Nein | Nein | Hoch | LocalServiceLegacyFlowService / FieldExtractionService |
| `buildConversationState` | Erzeugt semantischen Conversation State | Ja | Ja | Nein | Hoch | ConversationMetadataStateService |
| `buildPendingLeadState`, `buildPausedLeadState` | Lead-State fuer Metadata | Ja | Ja | Nein | Mittel | LeadCaptureFlowService |
| `getMissingContactFields` | Pflichtfelder allgemein und Local-Service-spezifisch | Ja | Ja | Nein | Hoch | ContactCollectionFlowService |
| `canAskForLeadDetails` | Regelt, ob Kontaktfragen gestellt werden duerfen | Ja | Ja | Nein | Hoch | ContactCollectionFlowService |
| `buildMissingFieldsQuestion` | Antwortfrage fuer fehlende Felder, inklusive Local-Service-Sprache | Ja | Ja | Nein | Hoch | ConversationResponsePolicyService |
| `buildCapturedLeadAnswer` | Abschlussantwort nach Lead/Kontakt | Ja | Ja | Nein | Mittel | ConversationResponsePolicyService |
| `buildLocalServicePricingAnswer`, `buildGreetingAnswer`, `buildRecoveryAnswer` | Regelbasierte Antworttexte | Ja | Ja | Nein | Mittel | ConversationResponsePolicyService |
| `buildLeadCta` | CTA fuer Lead Capture | Ja | Ja | Nein | Mittel | ConversationResponsePolicyService |
| `ChatPipelineService.process/stream` | Conversation anlegen, Agent-Orchestrator versuchen, Routing/RAG/LLM, Persistenz und Response Shape | Nein | Ja | Messages, usage, session touch | Hoch | Bleibt Pipeline Facade |
| `ChatPipelineService.executeDecisionTools` | Fuehrt Tools aus AgentDecision aus | Nein | Ja | Tools/Jobs/Tickets moeglich | Hoch | ToolExecutionPolicyService |
| `ResponseComposerService` | Prompt, Guide, Quellen, Parts | Ja | Ja | Nein | Mittel | ConversationResponsePolicyService |
| `WidgetChatService.observeAssistantProfile` | Read-only AssistantProfile Resolution und Logging | Nein | Ja | Log | Niedrig | Bleibt Observability / spaeter Context Service |

## Flow Map

### Public Widget Chat

1. `WidgetChatService.sendMessage` oder `streamMessage` laedt Site per `WidgetConfigService.getSiteByKey`.
2. Origin und Session werden ueber `WidgetSecurityService` geprueft.
3. `observeAssistantProfile` loest das Profil read-only auf und loggt nur strukturierte, nicht sensitive Felder.
4. `ChatPipelineService.process/stream` normalisiert Input, legt/aktualisiert Conversation und Message an.
5. `tryAgent` ruft `ChatAgentOrchestratorService.decide`.
6. Wenn der Orchestrator handled, wird eine regelbasierte Agent-Antwort persistiert.
7. Wenn nicht handled, folgt `prepareRoutedAnswer`: Routing, Retrieval, Response Composer, LLM oder Rule-Fallback.
8. Response Shape bleibt Public-Widget-kompatibel: `answer`, `parts`, `sources`, `messages`, keine Admin-/Preview-Felder.

### Routing und Guides

- `ChatRouteResolver` entscheidet zwischen `it-support`, `property-ticketing`, `ecommerce-product-advisor`, `lead-sales` und `faq`.
- Local-Service wird im Routing nur ueber explizite `lead-sales.intakeFlow`-Shape oder Keywords erkannt.
- `ResponseComposerService.buildConversationGuide` nutzt fuer explizite Legacy-Konfigurationen einen Local-Service Guide; sonst den generischen `conversation-guide`.
- `flow-builder` enthaelt noch generische Signale wie `contactIntent`, `qualifiedNeed`, `context`, `industry`, `urgency`. Das ist derzeit Prompt-/Guide-Logik, keine Public Response Erweiterung.

## Legacy Boundaries

### Local-Service Trigger

Local-Service entsteht nur ueber explizite Legacy-Signale:

- `botType=handwerker-first-contact`
- `industry` oder `templateId` mit Local-Service-Schluessel
- `assistantProfile.profileKey=local-service-first-contact`
- `lead-sales.intakeFlow` mit Local-Service Template/Shape
- `conversationFlow` mit Local-Service-Feldern wie `fullAddress`, `location`, `urgency`, `problem`
- laufender `pendingLead` oder Conversation State mit passendem Local-Service-Kontext

Wichtig: `industry=generic` und `botType=universal-assistant` duerfen nicht in Local-Service fallen. Dafuer existieren bereits Tests, z. B. fuer generische required fields und universelle Conversation Guides.

### IT-Support Trigger

IT-Support wird aktiv, wenn das Modul `it-support` enabled ist und die Nachricht IT-/Security-/Ticket-Signale enthaelt oder ein `pendingTicket` aktiv ist. Ticketanlage erfolgt nur nach explizitem Flow und ueber `ToolExecutorService.executeTool('create_ticket', ...)`.

### Lead Capture Trigger

Lead Capture ist aktiv, wenn:

- `lead-sales` enabled ist,
- `setupGoal` Lead/Appointment signalisiert,
- oder `leadCaptureEnabled !== false`.

Das ist absichtlich kompatibel, aber breit. Neue universelle Sites koennen dadurch weiterhin in Lead-/Contact-Collection geraten, wenn Kontakt- oder Angebotsintents erkannt werden.

### AssistantProfile Nutzung

Aktueller Live-Status:

- Widget loest AssistantProfile read-only auf und loggt `profileKey`, `legacySource`, Tasks, Agents und Required Field Keys.
- ChatAgentOrchestrator liest AssistantProfile nicht direkt.
- Live-Entscheidungen nutzen weiterhin Module/Site Config, conversationFlow, leadCaptureEnabled und Legacy-Fallbacks.
- Conversation Engine Preview/Compare bleibt Admin-/Operator-Testmodus und ist nicht Public Widget live.

## Side Effects

| Side Effect | Aktueller Ort | Ausloeser | Risiko |
| --- | --- | --- | --- |
| `conversations` insert | `ConversationStateService.ensureConversation` | Jede Chat-Anfrage | Erwartet, aber jeder Test erzeugt State |
| `messages` insert | `ConversationStateService.appendMessage` | User/Assistant Persistenz | PII-Redaktion nur fuer User mit `redact=true` |
| `widget_sessions.last_seen_at` | `ConversationStateService.touchWidgetSession` | Widget Chat | Erwartet |
| `conversations.metadata` update | `saveConversationMetadata` | Lead/Ticket/Conversation State | Shared mutable JSONB, hohes Drift-Risiko |
| `widget_leads` insert | `captureLead` | Vollstaendige Lead-Daten | Muss strikt auf explizite Pfade begrenzt bleiben |
| `widget_sessions.lead_captured` | `captureLead` und Pipeline persist | Lead Capture | Status kann mehrfach gespiegelt werden |
| `agent_contact_requests` insert | `createContactRequest` | Schedule/Contact Handoff | Ueberschneidet sich mit Lead Capture |
| `audit_logs` insert | `recordLeadAudit` | Pending/Lead/Schedule Events | Sollte keine PII enthalten |
| `email_jobs` insert | `queueInternalLeadNotification` | Lead captured + recipient + SMTP | Empfaenger/Lead-Daten sensibel |
| Ticket Tool / `agent_tickets` indirekt | `handleItSupportFlow` -> `toolExecutor.executeTool('create_ticket')` | Ticket Confirmation | Idempotenz und Confirmation kritisch |
| `usage_events` und `usage_daily` | `persistSuccessfulAssistantResponse` | Jede erfolgreiche Antwort | Erwartet |
| Retrieval/LLM Kosten | `prepareRoutedAnswer` | Nicht vom Orchestrator handled | Providerfehler muessen sauber bleiben |

## Risk Areas

- `ChatAgentOrchestratorService.decide` ist eine grosse Methode mit vielen Early Returns und Side Effects.
- Local-Service-Sprache, allgemeine Contact Collection und Lead Capture teilen sich dieselben ContactDetails und Missing-Fields-Helfer.
- `conversationState`, `pendingLead` und `pendingTicket` liegen gemeinsam in mutable JSONB-Metadata.
- Field Extraction ist regex-/textbasiert und stark mit Local-Service-Interpretation gekoppelt.
- Response Composer und Orchestrator enthalten beide Conversation-Guide-/Antwortpolitik.
- Lead Capture, Contact Request und IT Ticket koennen alle Handoff-artige Side Effects erzeugen.
- `leadCaptureEnabled !== false` ist kompatibel, aber breit und kann neue universelle Sites in Lead-Pfade bringen.
- AssistantProfile wird live beobachtet, aber noch nicht als Entscheidungsquelle verwendet.
- Conversation Engine Admin-Testmodus laeuft parallel zur Legacy-Live-Welt und darf nicht in Public Widget leaken.
- Provider-/LLM-Fehlerpfade sind teilweise Pipeline-, teilweise Orchestrator-/Tool-bezogen.
- Tests sind umfangreich, aber teilweise textabhaengig; kleine Antworttext-Extraktionen koennen viele Snapshots/Assertions betreffen.

## Proposed Modules

### LocalServiceLegacyFlowService

Soll enthalten:

- Local-Service-Erkennung aus expliziten Legacy-Signalen.
- Local-Service Missing Fields, Adresse, Dringlichkeit und spezifische Rueckfragen.
- Local-Service Pricing-/Stop-/Recovery-/Greeting-Antworten.

Soll nicht enthalten:

- Allgemeine Lead-Persistenz.
- E-Mail-Queueing.
- Universal Assistant requiredFields.

Abhaengigkeiten:

- `LocalServiceIntakeFlowConfig`, Legacy Config Guard, reine Field Extraction.

Tests zuerst:

- Explicit local service remains compatible.
- Generic/universal never receives Einsatzadresse-/Dringlichkeit-Sprache.
- Local pricing questions do not force lead capture.

Side Effects: keine, wenn sauber extrahiert.

### ItSupportTicketFlowService

Soll enthalten:

- PendingTicket State Machine.
- IT-/Security-/Ticket-Signale.
- Missing Ticket Fields.
- Confirmation/Cancel/Ready/Create Ticket Ablauf.

Soll nicht enthalten:

- Lead Capture.
- Generic Contact Collection.
- LLM/RAG-Prompting.

Abhaengigkeiten:

- `ToolExecutorService`, `ItSupportModuleConfig`, `ConversationMetadataStateService`.

Tests zuerst:

- Existing IT support ticket tests.
- No duplicate ticket on retry.
- Cancel/confirm routes remain exact.

Side Effects: Metadata und optional Ticket Tool.

### LeadCaptureFlowService

Soll enthalten:

- Lead Intent und Schedule Intent.
- PendingLead lifecycle.
- `widget_leads` Dedup/Insert.
- Lead audit.
- Optional Lead notification orchestration.

Soll nicht enthalten:

- Local-Service-spezifische Sprache.
- IT-Ticket-Flow.
- Public Widget response composition.

Abhaengigkeiten:

- `UsageLimitService`, `PrismaService`, optional Notification Service.

Tests zuerst:

- Multi-message lead capture.
- Dedup.
- Plan limit.
- SMTP missing does not fail lead storage.

Side Effects: Leads, sessions, audit, optional notification.

### ContactCollectionFlowService

Soll enthalten:

- Generic missing fields.
- Name/E-Mail/Telefon/Anliegen collection.
- Contact prompt limits and pause rules.

Soll nicht enthalten:

- Lead persistence.
- Local-Service address/urgency policy.
- Ticket-specific required fields.

Abhaengigkeiten:

- `FieldExtractionService`, response policy.

Tests zuerst:

- Contact-only inputs.
- Confusion/refusal/greeting pause.
- Required fields from AssistantProfile once live-wired.

Side Effects: none if it returns decisions/state patches.

### ConversationMetadataStateService

Soll enthalten:

- Typed parse/compact/save for `pendingLead`, `pendingTicket`, `conversationState`.
- State patch semantics.
- Optional optimistic/idempotency safeguards later.

Soll nicht enthalten:

- Business routing decisions.
- Response text.

Abhaengigkeiten:

- `PrismaService`.

Tests zuerst:

- State parse compatibility.
- Nulling pendingLead/pendingTicket.
- No accidental field loss.

Side Effects: `conversations.metadata`.

### FieldExtractionService

Soll enthalten:

- E-Mail/Telefon/Name extraction.
- Concern extraction.
- Local-Service address/urgency extraction behind explicit mode.
- Sensitive-data detection can remain separate or move into policy.

Soll nicht enthalten:

- DB writes.
- Response text.

Abhaengigkeiten:

- Optional Local-Service mode/config.

Tests zuerst:

- Name not treated as phone.
- Address only in local-service mode.
- Universal required fields do not become local fields.

Side Effects: none.

### UniversalAssistantFlowService

Soll enthalten:

- AssistantProfile requiredFields/active tasks interpretation.
- Universal contact/support/sales/handoff decisions.
- Generic next question policy.

Soll nicht enthalten:

- Legacy Local-Service fallback.
- Conversation Engine live switching.
- Ticket tool execution.

Abhaengigkeiten:

- Resolved `AssistantProfile`, FieldExtractionService, ContactCollectionFlowService.

Tests zuerst:

- `industry=generic` and `botType=universal-assistant` remain universal.
- Required fields and enabled tasks respected.
- No local-service wording.

Side Effects: initially none; later state patches only through metadata service.

### LegacyRoutingGuard

Soll enthalten:

- Single source for explicit legacy/local-service detection.
- Clear decision: universal vs explicit legacy.
- BotType/industry/template/conversationFlow/intakeFlow guard rules.

Soll nicht enthalten:

- Response text.
- Side effects.

Abhaengigkeiten:

- Site config, module config, optional AssistantProfile key.

Tests zuerst:

- Generic/universal false.
- Local-Service legacy true.
- Ambiguous conversationFlow does not trigger legacy without local shape.

Side Effects: none.

### ConversationResponsePolicyService

Soll enthalten:

- Rule-based answer text builders.
- CTA building.
- Policy around one-question-at-a-time and no lead pressure.
- Public response safety constraints.

Soll nicht enthalten:

- DB writes.
- Tool execution.

Abhaengigkeiten:

- Flow decisions, route decisions, localization constants.

Tests zuerst:

- Existing answer text compatibility.
- Public Widget response shape.
- Local vs universal wording.

Side Effects: none.

### HandoffPreparationService

Soll enthalten:

- Contact request creation.
- Handoff-ready state.
- Optional abstraction for notification dispatch.

Soll nicht enthalten:

- Lead qualification.
- Ticket creation.

Abhaengigkeiten:

- `PrismaService`, optional queue services.

Tests zuerst:

- Dedup contact request.
- No contact request without email/phone.
- No external dispatch unless configured.

Side Effects: `agent_contact_requests`, maybe jobs later.

### PublicWidgetSafetyGuard

Soll enthalten:

- Response-shape assertions and sanitizer helpers.
- No Admin/Preview/Knowledge debug fields.
- No full internal IDs or secrets.

Soll nicht enthalten:

- Business logic.

Abhaengigkeiten:

- Response DTO shape.

Tests zuerst:

- Widget config safety.
- Widget chat safety.
- Streaming event safety.

Side Effects: none.

## Refactor Phases

### Phase 1: Pure helper extraction

- Keine Logik- oder Textaenderung.
- Nur reine Funktionen aus `chat-agent-orchestrator.service.ts` in eigene Dateien/Services ziehen.
- Start mit Field Extraction, Local-Service Guards, Missing-Field Helpers und Antworttext-Buildern.
- Bestehende Tests muessen unveraendert gruen bleiben.

### Phase 2: LegacyRoutingGuard

- Eine zentrale Entscheidung fuer universal vs explicit legacy einfuehren.
- `industry=generic` und `botType=universal-assistant` explizit als universal absichern.
- Tests fuer generic/universal/local-service priorisieren.

### Phase 3: LocalServiceLegacyFlowService

- Local-Service-Intake aus `decide` herausloesen.
- Bestehende Legacy-/Handwerker-/Local-Service-Tests zuerst unveraendert uebernehmen.
- Keine Public Widget Response Shape Aenderung.

### Phase 4: ContactCollectionFlowService

- Generische Kontaktdatensammlung von Lead/Ticket/Local-Service trennen.
- Prompt-Limit, Pausen, Recovery und Refusal isolieren.
- Required fields spaeter an AssistantProfile anbinden, aber noch nicht Live-Verhalten umstellen.

### Phase 5: ItSupportTicketFlowService

- PendingTicket State Machine kapseln.
- Ticket Tool Execution nur hinter bestaetigtem Ready-State.
- Idempotenz und no-duplicate Tests staerken.

### Phase 6: UniversalAssistantFlowService

- Universal AssistantProfile requiredFields und enabledTasks sauber interpretieren.
- Keine Local-Service-Sprache.
- Keine Conversation Engine Live-Aktivierung.

### Phase 7: Conversation Engine Shadow Mode

- Erst nach stabiler Modularisierung.
- Nur Admin/Test/Shadow Mode.
- Keine Public Widget Live-Antwortumstellung in diesem Refactor.

## Required Tests

- Universal Site erzeugt keine Branchen-/Handwerker-/Einsatzadresse-/Dringlichkeits-Sprache.
- `industry=generic` und `botType=universal-assistant` bleiben universal.
- Legacy Local-Service bleibt kompatibel.
- Explicit `lead-sales.intakeFlow` aktiviert weiterhin Local-Service.
- Ambiguous/generic `conversationFlow.requiredFields` aktiviert kein Local-Service.
- IT-Support Ticket Flow bleibt kompatibel.
- Ticket Confirmation, Cancel und Retry bleiben idempotent.
- Contact Collection sammelt richtige Felder ohne Lead/Ticket-Side-Effect.
- No Debug Fields im Public Widget.
- Public Widget Chat Response Shape bleibt kompatibel.
- State Metadata bleibt stabil und verliert keine Felder.
- Keine unbeabsichtigten `widget_leads`, `email_jobs`, `webhook_jobs`, `agent_tickets`.
- AssistantProfile `requiredFields` und `enabledTasks` werden korrekt respektiert, sobald live verdrahtet.
- Fallbacks bei Provider-/LLM-Fehlern leaken keine Rohfehler.
- Lead-/Ticket-/Email-/Webhook-Jobs entstehen nur bei expliziten bestaetigten Pfaden.
- Streaming Events enthalten keine Admin-/Preview-/Knowledge-Debugfelder.

## Non-goals

- Keine Conversation Engine Live-Aktivierung.
- Keine Public Widget Engine-Antwort.
- Keine AssistantProfile-Migration.
- Keine Datenmigration.
- Keine Feature Flags.
- Keine Refactor-Implementierung in P1.2A.
- Kein Entfernen von Legacy-Feldern.
- Kein Aendern des Public Widget Response Shape.
- Kein Deploy.

## Recommended Next Step

P1.2B sollte mit Phase 1 starten: reine Helper-Extraktion ohne Verhaltensaenderung. Die beste erste Scheibe ist `FieldExtractionService` plus `LegacyRoutingGuard` als pure Funktionen mit vorhandenen Tests. Danach koennen Local-Service- und Contact-Collection-Flows getrennt werden, ohne Lead-/Ticket-Side-Effects oder Public Widget Shape anzufassen.
