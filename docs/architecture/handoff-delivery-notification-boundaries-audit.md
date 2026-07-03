# Handoff / Delivery / Notification Boundaries Audit

Datum: 2026-07-03
Scope: Read-only Micro-Audit zu Handoff, Delivery und Notification Boundaries in der Live-Chatlogik. Keine Code-, Deploy-, Migrations-, Feature-Flag-, Production-Config- oder Public-Widget-Aenderung.

## Summary

Handoff, Delivery und Notification sind aktuell kein einzelner klarer Service, sondern mehrere Side-Effect-Pfade:

- `ChatAgentOrchestratorService` entscheidet und fuehrt Lead-Notification, Contact Request, Lead Audit und Conversation-Metadata-Writes aus.
- `LeadCapture`-Builder erzeugen bereits reine Payloads und Commands, fuehren aber nichts aus.
- `ToolExecutorService` markiert Handoff in `conversations.metadata` und dispatcht Integration Events.
- `ToolDispatcherService` hat separate Agent-Run-Pfade fuer Lead Notification, Contact Request, Webhook Push und Ticket Creation.
- `IntegrationEventDispatcherService` queued `webhook_jobs` fuer aktive Integrationen.
- `EmailJobsService` queued und verarbeitet `email_jobs`.
- `WebhookJobsService` queued und verarbeitet `webhook_jobs`.
- `AssistantProfile` enthaelt `handoffRules` und `deliveryChannels`, ist aber nicht die Live-Entscheidungsquelle fuer das Public Widget.

Eine spaetere Extraktion sollte zuerst Policies und Payload-/Command-Builder isolieren. DB-/Queue-Writes, externe Dispatches und Public-Response-Assembly sollten in fruehen Phasen sichtbar beim Orchestrator beziehungsweise den bestehenden Tool-/Job-Services bleiben.

## Current Responsibilities

| Methode/Funktion | Datei | Verantwortung | liest Config | schreibt Metadata | erzeugt Side Effects | Antworttext | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Lead-Benachrichtigung pruefen, Mail-Payload bauen und `email_jobs` schreiben | `leadNotificationEmail`, SMTP-Konfiguration indirekt | Nein | `email_jobs`, Logs | Nein | Sehr hoch |
| `createContactRequest` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Kontakt-/Termin-Uebergabe als `agent_contact_requests` speichern | Nein | Nein | `agent_contact_requests` | Nein | Hoch |
| `recordLeadAudit` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Lead-/Conversation-Audit schreiben | Nein | Nein | `audit_logs` | Nein | Mittel |
| `saveConversationMetadata` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | `pendingLead`, `pendingTicket`, `conversationState` persistieren | Nein | Ja | `conversations.metadata` | Nein | Sehr hoch |
| Lead capture completion branch | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Lead finalisieren, Audit, Notification, Contact Request und Antwortaktion koordinieren | `leadNotificationEmail`, `scheduleUrl`, `contactUrl`, `setupGoal` | Ja | `widget_leads`, `email_jobs`, `agent_contact_requests`, `audit_logs` | Ja | Sehr hoch |
| Structured decision handoff branch | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Orchestrator-Aktion auf `handoff_to_contact` oder `normal_answer` setzen | Structured decision | Nein | Nein | Ja | Mittel |
| IT handoff signal handling | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | IT-Handoff-/Ticket-Wunsch in PendingTicket-Flow ueberfuehren | IT-Support-Konfiguration | Ja | Spaeter `agent_tickets` ueber ToolExecutor | Ja | Hoch |
| `buildLeadNotificationPayload` | `apps/api/src/chat/lead-capture.builders.ts` | Lead-Notification-Payload ohne Ausfuehrung bauen | Empfaenger als Parameter | Nein | Nein | Nein | Mittel |
| `buildLeadEmailJobPayload` | `apps/api/src/chat/lead-capture.builders.ts` | `email_jobs`-Payload ohne Insert bauen | Mail-Payload als Parameter | Nein | Nein | Nein | Mittel |
| `buildLeadSideEffectCommands` | `apps/api/src/chat/lead-capture.builders.ts` | Datenmodell fuer Lead-Side-Effect-Commands bauen | Parameter | Nein | Nein | Nein | Mittel |
| `buildTicketSideEffectCommands` | `apps/api/src/chat/it-support-ticket.helpers.ts` | Datenmodell fuer Ticket-Side-Effect-Commands bauen | Parameter | Nein | Nein | Nein | Mittel |
| `ToolExecutorService.handoff` | `apps/api/src/tools/tool-executor.service.ts` | Handoff in Metadata markieren und Integration Event dispatchen | Tool input | Ja | Integration dispatch, moeglich `webhook_jobs` | Ja | Sehr hoch |
| `ToolExecutorService.pushWebhook` | `apps/api/src/tools/tool-executor.service.ts` | Webhook-Verbindung pruefen und Webhook-Job queuen | Integration config/secrets | Nein | `webhook_jobs` | Ja | Sehr hoch |
| `ToolExecutorService.dispatchIntegrationEvent` | `apps/api/src/tools/tool-executor.service.ts` | Event an IntegrationEventDispatcher weiterreichen und Fehler isolieren | Integration config | Nein | Moeglich `webhook_jobs`, Audit im Dispatcher | Nein | Hoch |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Agent-Run-Lead erfassen und optional Mail-Notification queuen | `leadNotificationEmail`, SMTP-Konfiguration | Nein | `widget_leads`, `email_jobs` | Nein | Sehr hoch |
| `ToolDispatcherService.executeScheduleContact` | `apps/api/src/tools/tool-dispatcher.service.ts` | Agent-Run-Kontaktanfrage speichern | Nein | Nein | `agent_contact_requests` | Nein | Hoch |
| `ToolDispatcherService.executePushWebhook` | `apps/api/src/tools/tool-dispatcher.service.ts` | Integration-Webhook aus Agent Run queuen | Integration config/secrets | Nein | `webhook_jobs` | Nein | Sehr hoch |
| `IntegrationEventDispatcherService.dispatch` | `apps/api/src/integrations/integration-event-dispatcher.service.ts` | Aktive Event-Integrationen auswerten, Webhooks queuen und Audit schreiben | Integration connections/secrets | Nein | `webhook_jobs`, `audit_logs` | Nein | Sehr hoch |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Mail-Job persistieren und Verarbeitung anstossen | Mail payload | Nein | `email_jobs`, SMTP spaeter im Worker | Nein | Sehr hoch |
| `WebhookJobsService.enqueue` | `apps/api/src/tools/webhook-jobs.service.ts` | Webhook-Job persistieren und Verarbeitung anstossen | Endpoint, Headers, Signing | Nein | `webhook_jobs`, externe HTTP spaeter im Worker | Nein | Sehr hoch |
| `AssistantProfileResolverService` legacy mapping | `apps/api/src/assistant-profiles/assistant-profile-resolver.service.ts` | `leadNotificationEmail` in `deliveryChannels.email` normalisieren | `sites.config` | Nein | Nein | Nein | Niedrig |
| `AssistantProfileSaveService` | `apps/api/src/assistant-profiles/assistant-profile-save.service.ts` | `handoffRules` und `deliveryChannels` validieren und speichern | Admin payload | Nein | `site_modules` write | Nein | Mittel |

## Metadata / Config Usage

### Live-Konfiguration

- `sites.config.leadNotificationEmail`: aktueller Empfaenger-Fallback fuer Lead Notifications.
- `sites.config.notificationEmail` und `sites.config.contactEmail`: Fallbacks beim Laden der Site-Konfiguration.
- `sites.config.leadCaptureEnabled`: beeinflusst Lead-/Handoff-Verhalten und AssistantProfile-Legacy-Mapping.
- `sites.config.scheduleUrl` / `contactUrl`: beeinflusst `suggest_schedule` gegen `handoff_to_contact`.
- `sites.config.setupGoal`: beeinflusst Appointment-/ContactRequest-Pfad.
- `conversationFlow`: Legacy-Kontext fuer Local-Service- und Lead-Flows.
- `site_modules["lead-sales"]`: kann Intake-/Required-Field-Kontext liefern.
- aktive Integration Connections: bestimmen, ob Integration Events Webhooks queuen.
- SMTP-Konfiguration: bestimmt, ob Lead Notification in `email_jobs` geschrieben wird.

### AssistantProfile-Konfiguration

- `assistantProfile.handoffRules`: zukuenftig relevant fuer `enabled`, `requireAllFields`, `summarizeBeforeHandoff`, `handoffWhenUncertain` und Fallback-Instructions.
- `assistantProfile.deliveryChannels`: zukuenftig relevant fuer `email`, `webhook` und `system`.
- `assistantProfile.enabledTasks`: kann spaeter `prepare_handoff`, `trigger_integration`, `appointment` oder `create_ticket` steuern.
- `assistantProfile.requiredFields`: kann spaeter `requiredBeforeHandoff` bestimmen.

Wichtig: AssistantProfile wird aktuell fuer das Public Widget nicht als Live-Conversation-Engine verwendet. Die Felder sind Vorbereitung und Diagnosebasis, keine produktive Public-Widget-Aktivierung.

## Side Effects

| Stelle | email_jobs | webhook_jobs | widget_leads | agent_tickets | conversations.metadata | Audit | deliveryChannels | leadNotificationEmail | externe Integration | nur Text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `queueInternalLeadNotification` | Ja | Nein | Nein | Nein | Nein | Log-Events | Nein | Ja | SMTP spaeter via Worker | Nein |
| `captureLead` | Nein | Nein | Ja | Nein | Widget session flag | Nein | Nein | Nein | Nein | Nein |
| `createContactRequest` | Nein | Nein | Nein | Nein | Nein | Nein | Nein | Nein | Nein | Nein |
| `recordLeadAudit` | Nein | Nein | Nein | Nein | Nein | Ja | Nein | Nein | Nein | Nein |
| `saveConversationMetadata` | Nein | Nein | Nein | Nein | Ja | Nein | Nein | Nein | Nein | Nein |
| `ToolExecutorService.handoff` | Nein | Moeglich ueber Integration Event | Nein | Nein | Ja | Tool audit | Indirekt ueber Integrationen | Nein | Ja | Ja |
| `ToolExecutorService.pushWebhook` | Nein | Ja | Nein | Nein | Nein | Tool audit | Indirekt | Nein | Ja | Ja |
| `ToolDispatcherService.executeCaptureLead` | Ja, falls konfiguriert | Nein | Ja | Nein | Nein | Tool invocation | Nein | Ja | SMTP spaeter via Worker | Nein |
| `ToolDispatcherService.executeScheduleContact` | Nein | Nein | Nein | Nein | Nein | Tool invocation | Nein | Nein | Nein | Nein |
| `ToolDispatcherService.executePushWebhook` | Nein | Ja | Nein | Nein | Nein | Tool invocation | Indirekt | Nein | Ja | Nein |
| `IntegrationEventDispatcherService.dispatch` | Nein, E-Mail-Integrationen werden aktuell geskippt | Ja fuer Webhook-Typen | Nein | Nein | Nein | Ja | Indirekt | Nein | Ja | Nein |
| `EmailJobsService.enqueue` | Ja | Nein | Nein | Nein | Nein | Nein | Nein | Nein | SMTP spaeter im Worker | Nein |
| `WebhookJobsService.enqueue` | Nein | Ja | Nein | Nein | Nein | Nein | Nein | Nein | HTTP spaeter im Worker | Nein |

## Overlap with LeadCapture

LeadCapture ist der staerkste aktuelle Overlap:

- `widget_leads` wird im Orchestrator beziehungsweise ToolDispatcher geschrieben.
- `leadNotificationEmail` steuert den wichtigsten Mail-Delivery-Pfad.
- `email_jobs` wird direkt im Orchestrator oder ueber `EmailJobsService` geschrieben.
- Lead-Audit bleibt im Orchestrator.
- Lead-SideEffectCommands existieren bereits als pure Daten, werden aber noch nicht als zentrale Delivery-Boundary ausgefuehrt.
- `queue_webhook_job` ist im Lead-Command-Modell vorgesehen, aber der Live-Orchestrator nutzt fuer Lead Notifications derzeit primaer E-Mail.

Risiko: Eine zu fruehe Delivery-Extraktion koennte Lead-Erstellung, Lead-Audit, Mail-Queueing und Public-Antworten vermischen.

## Overlap with TicketFlow

TicketFlow hat aehnliche Risiken, aber andere Zieltabellen:

- `agent_tickets` bleibt in ToolExecutor/ToolDispatcher-Pfaden.
- Ticket-Forwarding nutzt Integration Events und kann `webhook_jobs` erzeugen.
- `pendingTicket` und Ticket-Metadata bleiben in `conversations.metadata`.
- Ticket-SideEffectCommands sind pure Daten und koennen spaeter Delivery Commands referenzieren.
- Ticket Notification/Audit ist bewusst noch nicht in einen Delivery-Service verschoben.

Risiko: Ein gemeinsamer DeliveryExecutor darf nicht versehentlich Lead- und Ticket-Payloads gleich behandeln oder Ticket-Forwarding-Status falsch in Public-Antworten spiegeln.

## Overlap with ContactCollection

ContactCollection ist vorgelagert und sollte side-effect-arm bleiben:

- sammelt Name, E-Mail, Telefon, Anliegen und Appointment-Kontext.
- bereitet `pendingLead` und `conversationState` vor.
- erzeugt keine `email_jobs`, `webhook_jobs`, `widget_leads` oder `agent_tickets`.
- kann ContactRequest-Voraussetzungen liefern, fuehrt aber keine Delivery aus.

Risiko: Delivery-Logik darf nicht in ContactCollection zurueckwandern. ContactCollection sollte nur Datenqualitaet und Vollstaendigkeit liefern.

## AssistantProfile Relevance

Aktuelle Relevanz:

- `AssistantProfileResolverService` mappt Legacy-`leadNotificationEmail` auf `deliveryChannels.email`.
- `AssistantProfileSaveService` validiert `deliveryChannels.email`, `deliveryChannels.webhook`, `deliveryChannels.system` sowie `handoffRules`.
- Admin-/Diagnose- und Migration-Preview-Funktionen koennen diese Felder anzeigen oder speichern.

Zukuenftige Relevanz:

- `handoffRules.enabled`: ob Handoff vorbereitet werden darf.
- `handoffRules.requireAllFields`: ob Required Fields vor Handoff vollstaendig sein muessen.
- `handoffRules.summarizeBeforeHandoff`: ob vor Delivery eine strukturierte Zusammenfassung gebaut werden muss.
- `handoffRules.handoffWhenUncertain`: ob Unsicherheit in Handoff statt Antwort fuehren darf.
- `deliveryChannels.email.enabled`: ob E-Mail-Delivery in Commands entstehen darf.
- `deliveryChannels.webhook.enabled`: ob Webhook-Delivery in Commands entstehen darf.
- `deliveryChannels.system.enabled`: ob interne Systemuebergabe als Command modelliert werden darf.
- `enabledTasks`: Begrenzung auf `prepare_handoff`, `trigger_integration`, `appointment` oder `create_ticket`.
- `requiredFields`: Feldbasis fuer `requiredBeforeHandoff`.

Nicht behaupten: AssistantProfile ist noch keine Live-Public-Widget-Engine. Ein spaeterer Handoff-/Delivery-Service sollte AssistantProfile nur nach expliziter Freigabe als produktive Entscheidungsquelle nutzen.

## Proposed Boundary Services

### A. HandoffPolicyService

Zustaendig:

- entscheidet, ob Uebergabe vorbereitet werden darf oder soll.
- prueft `requiredBeforeHandoff` / `requireAllFields`.
- prueft `summaryBeforeHandoff` / `summarizeBeforeHandoff`.
- prueft `fallbackBehavior` und `handoffWhenUncertain`.
- erzeugt keine DB-, Queue- oder Integration-Side-Effects.

Nicht zustaendig:

- `email_jobs`, `webhook_jobs`, `widget_leads`, `agent_tickets`.
- Public-Response-Assembly.
- ToolExecutor/ToolDispatcher-Ausfuehrung.

### B. DeliveryCommandBuilder

Zustaendig:

- baut `queue_email_job` Commands.
- baut `queue_webhook_job` Commands.
- baut `prepare_system_handoff` Commands.
- baut `record_delivery_audit` Commands.
- baut `update_metadata` Patches als Daten.
- validiert, dass keine leeren Ziele Commands erzeugen.

Nicht zustaendig:

- persistieren.
- senden.
- externe Integrationen aufrufen.
- Retry-/Worker-Logik.

### C. DeliveryExecutorService, spaeter

Zustaendig, erst nach separatem Audit:

- `email_jobs` schreiben.
- `webhook_jobs` schreiben.
- Integrationsereignisse ausloesen.
- Delivery-Audit schreiben.
- fehlende Konfiguration als kontrolliertes No-op behandeln.

Nicht fuer fruehe Phasen:

- kein automatisches Zusammenlegen bestehender ToolExecutor-/ToolDispatcher-Pfade.
- keine Public-Widget-Verhaltensaenderung.

### D. NotificationSafetyGuard

Zustaendig:

- keine Secrets in Payloads.
- keine leeren Empfaenger oder Endpoints.
- keine ungewollte Zustellung bei disabled Channels.
- keine privaten Headers in Logs.
- no-op bei fehlender Konfiguration.
- klare Statuscodes wie `not_configured`, `queued`, `failed`, `skipped`.

## SideEffect Command Model

Ein fruehes Modell sollte nur Daten erzeugen:

```ts
type DeliverySideEffectCommand =
  | { type: "queue_email_job"; payload: EmailJobPayload }
  | { type: "queue_webhook_job"; payload: WebhookJobPayload }
  | { type: "prepare_system_handoff"; payload: SystemHandoffPayload }
  | { type: "record_delivery_audit"; payload: DeliveryAuditPayload }
  | { type: "update_metadata"; patch: Record<string, unknown> };
```

Regeln:

- fruehe Phasen bauen nur Commands.
- Orchestrator oder bestehende Services fuehren weiter aus.
- kein versteckter DB-/Queue-Write im Builder.
- kein externer HTTP-/SMTP-Aufruf im Builder.
- Payloads werden vor Ausfuehrung durch `NotificationSafetyGuard` geprueft.

## Refactor Phases

### Phase 1: Pure Handoff Policy Helpers

- Extrahiere reine Entscheidungshilfen fuer `requiredBeforeHandoff`, `summaryBeforeHandoff`, `fallbackBehavior` und `handoffWhenUncertain`.
- Keine DB-/Queue-Writes.
- Keine Antworttexte aendern.
- Public Widget Response Shape unveraendert lassen.

### Phase 2: Delivery Payload Builders

- Extrahiere Builder fuer E-Mail-, Webhook- und System-Handoff-Payloads.
- Keine Ausfuehrung.
- Keine Secrets in Payloads.
- Keine Logs mit Empfaengern oder Headers.

### Phase 3: DeliverySideEffectCommand Builder

- Commands aus Policy- und Payload-Entscheidungen bauen.
- Orchestrator bleibt Executor.
- Bestehende `EmailJobsService`, `WebhookJobsService`, `IntegrationEventDispatcherService` bleiben die Ausfuehrungspfade.

### Phase 4: Boundary Tests erweitern

- HandoffPolicy-Tests.
- DeliveryCommand-Tests.
- Lead/Ticket/Contact regression tests.
- Public Widget response-shape tests.
- No-side-effect source tests fuer pure Builder.

### Phase 5: Optionaler DeliveryExecutorService

- Nur nach separatem Audit.
- Nur mit starker Testabdeckung.
- Muss idempotent und tenant-/site-isoliert sein.
- Muss fehlende Konfiguration als kontrolliertes No-op behandeln.

## Required Tests

### Handoff Policy

- `requiredBeforeHandoff` wird respektiert.
- `summaryBeforeHandoff` wird respektiert.
- `fallbackBehavior` bleibt stabil.
- keine Uebergabe bei fehlenden Pflichtfeldern.
- Unsicherheit startet nur mit expliziter Freigabe einen Handoff-Pfad.

### Delivery Commands

- E-Mail-Job nur mit gueltigem Ziel.
- Webhook-Job nur mit gueltiger URL und aktiver Konfiguration.
- kein Throw bei fehlender Delivery-Konfiguration.
- kein Command bei disabled delivery channel.
- Payload enthaelt keine Secrets.
- Headers und Signing Secrets werden nicht in Audit-/Debug-Ausgaben geleakt.
- fehlende SMTP-Konfiguration bleibt No-op oder kontrollierter Skip.

### Regression

- Lead Capture bleibt kompatibel.
- Ticket Flow bleibt kompatibel.
- Contact Collection bleibt kompatibel.
- Public Widget Response Shape bleibt unveraendert.
- keine unerwarteten `email_jobs` oder `webhook_jobs`.
- keine echten Integrationen ohne expliziten Pfad.
- ToolExecutor-/ToolDispatcher-Pfade bleiben getrennt, bis ein eigener Audit sie konsolidiert.
- Delivery-Status `queued`, `skipped`, `not_configured`, `failed` bleibt korrekt.

## Non-goals

- Keine Conversation Engine Live-Aktivierung.
- Keine AssistantProfile-Migration.
- Keine Feature Flags.
- Keine Public Widget Response Aenderung.
- Keine DB-Migration.
- Keine neue Delivery-Logik.
- Keine E-Mail-/Webhook-Aenderung.
- Keine Antworttext-Modernisierung.
- Kein Verschieben von DB-/Queue-Writes in fruehen Phasen.
- Kein Zusammenlegen von `ToolExecutorService` und `ToolDispatcherService`.
- Kein automatisches Aktivieren von `deliveryChannels`.
- Kein produktiver Rollout von Handoff-/Delivery-Entscheidungen.

## Recommended Next Step

P1.2B-6B sollte mit Phase 1 starten: reine HandoffPolicy-Helper extrahieren, ohne Side Effects, ohne Antworttextaenderung und ohne Public-Widget-Response-Aenderung.

Nicht direkt starten:

- DeliveryExecutorService.
- ToolExecutor/ToolDispatcher-Konsolidierung.
- Aktivierung von `assistantProfile.deliveryChannels` im Public Widget.
- neue E-Mail-/Webhook-Routinglogik.
