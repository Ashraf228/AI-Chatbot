# Delivery Payload / Notification Safety Audit

Datum: 2026-07-04

## Summary

Delivery Payload und Notification Safety sind aktuell ueber mehrere Live-Chat- und Integrationspfade verteilt. Die wichtigsten Side Effects bleiben sichtbar in `ChatAgentOrchestratorService`, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationEventDispatcherService`, `EmailJobsService` und `WebhookJobsService`.

P1.2B-7 sollte nicht direkt einen `DeliveryExecutorService` einfuehren. Der risikoarme naechste Schritt ist zuerst ein reiner `NotificationSafetyGuard`, danach reine Delivery-Payload-Builder und erst spaeter Side-Effect-Command-Builder. DB-/Queue-Writes und externe Dispatches muessen in fruehen Phasen beim Orchestrator beziehungsweise den bestehenden Services bleiben.

## Status After P1.2B-7

P1.2B-7 ist umgesetzt, gemerged und production-validiert.

- `apps/api/src/chat/notification-safety.guard.ts` enthaelt reine, zustandslose Helper fuer sensitive Delivery-Key-/Path-Erkennung, Header-/Config-/Payload-Sanitizing, Public-Unsafe-Key-Erkennung und no-op Delivery-Entscheidungen.
- Das bestehende Admin-Read-Sanitizing fuer `assistantProfile.deliveryChannels` nutzt den Guard.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `DeliveryPayloadBuilder`, `DeliverySideEffectCommandBuilder` und `DeliveryExecutor` wurden nicht eingefuehrt.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `ToolExecutorService` und `ToolDispatcherService` wurden nicht verschoben.
- Der production-safe API-only Deploy auf `3727a5d5bbed6f3febaadf7b952f81464a07b3bf` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

Der naechste sinnvolle Schritt ist nicht Delivery-Ausfuehrung, sondern `P1.2B-8A` als DeliveryPayload-Builder Micro-Plan / Scope-Check. Der Scope ist in `docs/architecture/delivery-payload-builder-scope.md` dokumentiert.

## Status After P1.2B-8

P1.2B-8 ist umgesetzt, gemerged und production-validiert.

- `DeliveryPayloadBuilder` wurde als reine Payload-/Projection-Grenze eingefuehrt.
- Lead-/Email-Payload Builder, no-op Delivery Target Decisions und audit-/log-safe Projektionen sind extrahiert.
- `NotificationSafetyGuard` bleibt die Sanitizing- und no-op-Safety-Grenze fuer Delivery-nahe Daten.
- `lead-capture.builders.ts` bleibt API-kompatibel und delegiert an die neue Builder-Datei.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `ToolExecutorService`, `ToolDispatcherService` und `IntegrationDispatcher` wurden nicht verschoben.
- Webhook-Payloads mit Signing/Headern, `DeliverySideEffectCommandBuilder` und `DeliveryExecutor` bleiben nicht extrahiert.
- Der production-safe API-only Deploy auf `cbf561963bf4b33faa5889af79c71b7ae2127fb0` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

## Status After P1.2B-9

P1.2B-9 ist umgesetzt, gemerged und production-validiert.

- `DeliverySideEffectCommandBuilder` wurde als reine Datenobjekt-Schicht eingefuehrt.
- `queue_email_job` bleibt ein Datenobjekt und wird durch den neuen Helper nicht ausgefuehrt.
- `noop` bleibt ein Datenobjekt.
- Audit-/Log-safe Command-Projektionen und E-Mail-/Telefon-Redaction sind validiert.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationDispatcher` und `WebhookJobsService` wurden nicht verschoben.
- Webhook-Commands mit Signing/Headern, `DeliveryExecutor` und echte Delivery-Ausfuehrung bleiben nicht extrahiert.
- Der production-safe API-only Deploy auf `3e6f71cc235f7cc01a6cc41949dd7ac683241722` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

## Status After P1.2B-10

P1.2B-10 ist umgesetzt, gemerged und production-validiert.

- `DeliveryExecutionBoundary` wurde als reine Validation-/ExecutionPlan-Schicht eingefuehrt.
- Delivery Command Classification, E-Mail-Queue-Command-Validation, `noop`-/`blocked`-/E-Mail-Queue-ExecutionPlan-Datenobjekte und audit-/log-safe ExecutionPlan-Projektionen sind extrahiert.
- E-Mail-/Telefon-Redaction fuer sichere ExecutionPlan-Projektionen ist validiert.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationDispatcher`, `WebhookJobsService` und `EmailJobsService` wurden nicht verschoben.
- Execution Plans werden nicht ausgefuehrt und sind nicht in den Orchestrator verdrahtet.
- Webhook Execution, Webhook-Signing/Header-Handling, echter DeliveryExecutor und externe Integrationen bleiben nicht extrahiert.
- Der production-safe API-only Deploy auf `b852b40a1a6a0afaeb2fcd9441483bdc2dd7ae37` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

## Status After P1.2B-11

P1.2B-11 ist umgesetzt, gemerged und production-validiert.

- `EmailDeliveryExecutor` Boundary wurde als reine Validation-/Result-Schicht eingefuehrt.
- Email Delivery Plan Classification, Plan Validation, `ready`-/`skipped`-/`blocked`-/`failed`-Result-Datenobjekte und audit-/log-safe Result-Projektionen sind extrahiert.
- E-Mail-/Telefon-Redaction fuer sichere Result-Projektionen ist validiert.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationDispatcher`, `WebhookJobsService` und Worker-/SMTP-Ausfuehrung wurden nicht verschoben.
- Results werden nicht ausgefuehrt und sind nicht in den Orchestrator verdrahtet.
- Webhook Execution, Webhook-Signing/Header-Handling, echter DeliveryExecutor und externe Integrationen bleiben nicht extrahiert.
- Der production-safe API-only Deploy auf `eed94afb67107329156ee59265093e49e1dce09a` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

## Status After P1.2B-12

P1.2B-12 ist umgesetzt, gemerged und production-validiert.

- `EmailQueueWriteBoundary` wurde als reine Validation-/Request-/Result-Schicht eingefuehrt.
- Source Result Classification, Queue Write Validation, `ready`-/`skipped`-/`blocked`-/`failed`-Result-Datenobjekte und audit-/log-safe Request-/Result-Projektionen sind extrahiert.
- E-Mail-/Telefon-Redaction fuer sichere Queue-Write-Projektionen ist validiert.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationDispatcher`, `WebhookJobsService` und Worker-/SMTP-Ausfuehrung wurden nicht verschoben.
- Queue Write Requests und Results werden nicht ausgefuehrt und sind nicht in den Orchestrator verdrahtet.
- Webhook Execution, Webhook-Signing/Header-Handling, echter DeliveryExecutor und externe Integrationen bleiben nicht extrahiert.
- Der production-safe API-only Deploy auf `863739b1337e4ba6de48beb6779d861d2da117ce` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

## Status After P1.2B-13

P1.2B-13 ist umgesetzt, gemerged und production-validiert.

- `EmailJobPersistenceBoundary` wurde als reine Validation-/Request-/Result-Schicht eingefuehrt.
- Source Queue Write Result Classification, Persistence Validation, `ready`-/`skipped`-/`blocked`-/`failed`-Result-Datenobjekte und audit-/log-safe Request-/Result-Projektionen sind extrahiert.
- E-Mail-/Telefon-Redaction fuer sichere Persistence-Projektionen ist validiert.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Processing-Trigger-Typen, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationDispatcher`, `WebhookJobsService` und Worker-/SMTP-Ausfuehrung wurden nicht verschoben.
- Persistence Requests und Results werden nicht ausgefuehrt und sind nicht in den Orchestrator verdrahtet.
- Webhook Execution, Webhook-Signing/Header-Handling, echter DeliveryExecutor und externe Integrationen bleiben nicht extrahiert.
- Der production-safe API-only Deploy auf `8604f60f2a2822693f11b6accb066f3afab56c9f` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

## Status After P1.2B-14

P1.2B-14 ist umgesetzt, gemerged und production-validiert.

- `EmailJobProcessingTriggerBoundary` wurde als reine ProcessingTriggerRequest-/ProcessingTriggerResult-Schicht eingefuehrt.
- Source Persistence Result Classification, Processing Trigger Validation, `ready_to_trigger`-/`skipped`-/`blocked`-/`failed`-Result-Datenobjekte und audit-/log-safe Request-/Result-Projektionen sind extrahiert.
- E-Mail-/Telefon-Redaction fuer sichere ProcessingTrigger-Projektionen ist validiert.
- Public Widget Response Shape, Antworttexte, Live-Delivery-Entscheidungen und Side Effects blieben unveraendert.
- `email_jobs`, `webhook_jobs`, `queueInternalLeadNotification`, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs`, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationDispatcher`, `WebhookJobsService` und Worker-/SMTP-Ausfuehrung wurden nicht verschoben.
- ProcessingTriggerRequests und ProcessingTriggerResults werden nicht ausgefuehrt und sind nicht in den Orchestrator verdrahtet.
- Webhook Execution, Webhook-Signing/Header-Handling, echter DeliveryExecutor, Queue-/Processing-Ausfuehrung, Retry-/Status-/Locking-Aenderungen, `report_runs` Sync und externe Integrationen bleiben nicht extrahiert.
- Der production-safe API-only Deploy auf `3bfd9854894b7c5d241534877bf335e300dccd93` war erfolgreich; Migration blieb `028_generic_webhook_signing_modes.sql` mit 28 angewendeten Migrationen.

## Current Responsibilities

| Methode/Funktion | Datei | Verantwortung | liest Config | baut Payload | erzeugt Side Effects | sensitive Werte | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Lead-Benachrichtigung pruefen, Mail-Payload bauen und `email_jobs` direkt schreiben | `leadNotificationEmail`, SMTP-Konfiguration indirekt | Ja, via `buildLeadNotificationPayload` und `buildLeadEmailJobPayload` | Ja, `email_jobs`, Logs | `recipientEmail`, Lead-Kontaktfelder | Hoch |
| `buildLeadNotificationPayload` | `apps/api/src/chat/lead-capture.builders.ts` | Lead-Notification-Datenobjekt bauen | `recipientEmail`, Site-/Lead-Daten als Parameter | Ja | Nein | `recipientEmail`, Lead-Kontaktfelder | Mittel |
| `buildLeadEmailJobPayload` | `apps/api/src/chat/lead-capture.builders.ts` | Mail-Job-Payload aus gerendertem Mail-Objekt bauen | Mail-Objekt als Parameter | Ja | Nein | `recipientEmail`, `leadEmail` | Mittel |
| `buildLeadSideEffectCommands` | `apps/api/src/chat/lead-capture.builders.ts` | Pure Lead-Side-Effect-Commands vorbereiten | Kontakt-, Site- und Mail-Parameter | Ja | Nein | Kontaktfelder, Mail-Ziel | Mittel |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Mail-Job persistieren und Worker anstossen | Mail-Payload | Nein | Ja, `email_jobs`, Worker-Trigger | Empfaenger, Mail-Inhalt | Hoch |
| `LeadMailerService.buildLeadNotification` | `apps/api/src/modules/widget/services/lead-mailer.service.ts` | HTML/Text-Mail fuer Lead Notification rendern | Lead-Notification-Payload | Ja | Nein | Kontaktfelder, Dashboard-Link | Mittel |
| `ToolExecutorService.pushWebhook` | `apps/api/src/tools/tool-executor.service.ts` | Webhook-Verbindung pruefen und Webhook-Job queuen | Integration config/secrets | Ja | Ja, `webhook_jobs` | Endpoint, Headers, Signing Secret | Sehr hoch |
| `ToolDispatcherService.executePushWebhook` | `apps/api/src/tools/tool-dispatcher.service.ts` | Agent-Run-Webhook queuen | Integration config/secrets | Ja | Ja, `webhook_jobs` | Endpoint, Headers, Signing Secret | Sehr hoch |
| `ToolDispatcherService.createTicket` forwarding branch | `apps/api/src/tools/tool-dispatcher.service.ts` | Ticket-Webhooks fuer externe Systeme queuen | Ticket-Webhook-Verbindung | Ja | Ja, `webhook_jobs`, `agent_tickets` | Reporter-Kontaktfelder, Auth-Header | Sehr hoch |
| `IntegrationEventDispatcherService.dispatch` | `apps/api/src/integrations/integration-event-dispatcher.service.ts` | Aktive Event-Integrationen auswerten, Webhook-Jobs queuen und Audit schreiben | Integration config/secrets/events | Ja | Ja, `webhook_jobs`, Audit | Headers, Signing Secret, Event Payload | Sehr hoch |
| `IntegrationsService.buildHeaders` | `apps/api/src/integrations/integrations.service.ts` | Transport- und Legacy-Signing-Header bauen | `headers`, `bearerToken`, `apiKey`, Signing Secret | Ja | Nein | Authorization, API key, Legacy Secret | Sehr hoch |
| `WebhookJobsService.enqueue` | `apps/api/src/tools/webhook-jobs.service.ts` | Webhook-Job persistieren, Payload serialisieren und Signing Secret schuetzen | Endpoint, Headers, Payload, Signing Secret | Ja | Ja, `webhook_jobs`, Worker-Trigger | Endpoint, Headers, Signing Secret | Sehr hoch |
| `WebhookJobsService.processJob` | `apps/api/src/tools/webhook-jobs.service.ts` | Webhook senden, HMAC signieren, Retry-/Failure-State schreiben | Job-Zeile, Signing Secret | Nein | Ja, externe HTTP-Delivery, `webhook_jobs` Updates | Signing Secret, Auth-Header | Sehr hoch |
| `AssistantProfileResolverService` delivery mapping | `apps/api/src/assistant-profiles/assistant-profile-resolver.service.ts` | Legacy `leadNotificationEmail` auf `deliveryChannels.email` normalisieren | `sites.config` | Nein | Nein | Recipient-Feld | Mittel |
| `AssistantProfileSaveService` delivery validation | `apps/api/src/assistant-profiles/assistant-profile-save.service.ts` | Admin-Payload fuer `deliveryChannels` validieren und speichern | Admin-Payload | Nein | Ja, `site_modules` write | Recipient-Feld, Channel Status | Mittel |
| Admin read sanitizing | `apps/api/src/modules/widget/services/widget-admin-site.service.ts` | `recipientEmail`, `secret`, `signingSecret`, `token`, `apiKey` aus AssistantProfile-Admin-Read entfernen | AssistantProfile config | Nein | Nein | Delivery-Felder | Mittel |

## Metadata / Config Usage

| Quelle | Aktuelle Nutzung | Risiko |
| --- | --- | --- |
| `sites.config.leadNotificationEmail` | Live-Orchestrator-Ziel fuer interne Lead-Mail; auch Legacy-Quelle fuer `assistantProfile.deliveryChannels.email` | Echte Empfaengeradresse darf nicht in Public Responses, Logs oder Diagnose-DTOs landen |
| `sites.config.notificationEmail` / `contactEmail` | Fallback fuer `leadNotificationEmail` im Orchestrator | Kann unklaren Source-of-Truth erzeugen |
| `sites.config.leadCaptureEnabled` | Legacy-Signal fuer Handoff-/Delivery-Mapping im AssistantProfile Resolver | Darf Delivery nicht automatisch aktivieren |
| `assistantProfile.deliveryChannels.email` | Admin-/Migration-/Diagnose-Datenmodell; nicht Public-Widget-Live-Engine | Gefahr falscher Annahme, dass gespeicherte Channels live senden |
| `assistantProfile.deliveryChannels.webhook` | Validiertes Profilfeld, aktuell nicht automatische Live-Delivery | Muss ohne Executor no-op bleiben |
| `assistantProfile.deliveryChannels.system` | Validiertes Profilfeld fuer spaetere Systemuebergabe | Darf keine Ticket-/Lead-Erzeugung implizieren |
| `assistantProfile.handoffRules` | HandoffPolicy nutzt Regeln fuer Prepare/Defer; keine Delivery-Ausfuehrung | Scope muss fachlich von Payload-Bau getrennt bleiben |
| `site_modules["lead-sales"]` | Legacy-Intake-/Lead-Konfiguration | Kann mit AssistantProfile-Delivery kollidieren |
| Integration config `url` / `endpointUrl` / `webhookUrl` | Webhook-Ziel in Tool- und Event-Pfaden | Muss Public-URL-validiert bleiben |
| Integration config `headers` | Kundenseitige Zusatzheader | Reservierte Signature-/SSB-Header muessen blockiert bleiben |
| Integration secrets `bearerToken`, `apiKey`, `secret`, `signingSecret` | Header-/Signing-Bau | Darf nie in Public DTOs, Logs oder Audit-Metadaten unmaskiert erscheinen |

## Sensitive Value Boundaries

- `recipientEmail` wird im Orchestrator, in Lead-Payloads und in `email_jobs` verarbeitet. Der Wert ist fuer interne Delivery notwendig, darf aber nicht in Public Widget Responses oder Admin-Diagnose-DTOs erscheinen.
- Lead-Kontaktfelder werden in `widget_leads`, Mail-Payloads und E-Mail-Job-Metadaten verarbeitet. Logs und Audits sollten nur Booleans oder IDs enthalten, nicht Volltexte.
- Webhook-Ziele werden ueber `validatePublicIntegrationUrl` gegen lokale/private Ziele abgesichert. Diese Validierung muss vor jedem Queueing erhalten bleiben.
- `IntegrationsService.buildHeaders` kann Transport-Auth-Header und Legacy-Signing-Header bauen. `maskSensitiveRecord` maskiert sensitive Header fuer Audit-Metadaten.
- HMAC-Signing speichert das Signing Secret separat in `webhook_jobs.signing_secret`; `WebhookJobsService.processJob` signiert den exakten `payload_body` und entfernt Legacy-Secret-Header im HMAC-Modus.
- Admin-Read fuer AssistantProfile entfernt `recipientEmail`, `secret`, `signingSecret`, `token` und `apiKey` aus `deliveryChannels`.
- Tool-Input-Logging redigiert Secret-/Token-/Password-/API-Key-Felder und maskiert E-Mail/Telefon/Name.

Bekannte Risikozonen:

- `queueInternalLeadNotification` loggt aktuell `recipientEmail` bei SMTP-missing, queued und failed Events. Das ist intern, aber fuer eine spaetere Safety-Guard-Grenze ein Kandidat fuer Maskierung.
- `buildLeadEmailJobPayload` legt `leadEmail` in Job-Metadaten ab. Das ist fuer interne Verarbeitung nutzbar, sollte aber niemals in Public/Audit-Diagnosen durchgereicht werden.
- ToolDispatcher-Ticket-Forwarding baut Auth-Header lokal statt ueber den zentralen `IntegrationsService.buildHeaders`; das ist kompatibel, aber erhoeht Drift-Risiko.
- `IntegrationEventDispatcherService` hat eigene Webhook-Job-Insert-Logik neben `WebhookJobsService.enqueue`; das ist ein Duplikationsrisiko fuer Safety-Regeln.

## Side Effects

| Pfad | email_jobs | webhook_jobs | externe Integration | conversations.metadata | Audit | deliveryChannels | leadNotificationEmail | sensitive Werte | nur Payload |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `queueInternalLeadNotification` | Ja | Nein | Spaeter via Mail-Worker | Nein | Nein | Nein | Ja | Ja | Nein |
| `buildLeadNotificationPayload` | Nein | Nein | Nein | Nein | Nein | Nein | Ja, als Parameter | Ja | Ja |
| `buildLeadEmailJobPayload` | Nein | Nein | Nein | Nein | Nein | Nein | Indirekt | Ja | Ja |
| `EmailJobsService.enqueue` | Ja | Nein | Spaeter via Worker | Nein | Nein | Nein | Indirekt | Ja | Nein |
| `ToolExecutorService.pushWebhook` | Nein | Ja | Spaeter via Worker | Nein | Tool-Audit via Executor | Nein | Nein | Ja | Nein |
| `ToolDispatcherService.executePushWebhook` | Nein | Ja | Spaeter via Worker | Nein | Tool invocation | Nein | Nein | Ja | Nein |
| `ToolDispatcherService.createTicket` forwarding | Nein | Ja | Spaeter via Worker | Nein | Tool invocation | Nein | Nein | Ja | Nein |
| `IntegrationEventDispatcherService.dispatch` | Nein | Ja | Spaeter via Worker | Nein | Ja | Nein | Nein | Ja | Nein |
| `WebhookJobsService.enqueue` | Nein | Ja | Spaeter via Worker | Nein | Nein | Nein | Nein | Ja | Nein |
| `WebhookJobsService.processJob` | Nein | Updates | Ja | Nein | Nein | Nein | Nein | Ja | Nein |
| AssistantProfile diagnostics/read | Nein | Nein | Nein | Nein | Nein | Ja, sanitized | Nein | Ja, sanitized | Nein |

## Overlap With LeadCapture

LeadCapture entscheidet, ob ein Lead fertig ist, erzeugt `widget_leads`, setzt `pendingLead`/`conversationState`, schreibt Lead-Audit und stoesst interne Benachrichtigung an.

DeliveryPayload sollte spaeter nur:

- Mail-/Webhook-/System-Payloads bauen,
- Ziele validieren,
- no-op bei fehlender Konfiguration modellieren,
- keine Lead-Finalisierung entscheiden,
- keine `widget_leads` schreiben,
- keine Antworttexte oder Post-Capture-Aktionen bestimmen.

## Overlap With TicketFlow

TicketFlow entscheidet Ticket-Completion, erzeugt `agent_tickets`, setzt `pendingTicket` und bestimmt Forwarding-Status.

DeliveryPayload kann spaeter Ticket-Benachrichtigungs- oder Webhook-Payloads bauen, darf aber nicht:

- Ticket-Erzeugung entscheiden,
- `agent_tickets` schreiben,
- Forwarding-Status ohne echte Queue-Bestaetigung setzen,
- Public-Antworten um Ticket-Delivery-Details erweitern.

## Overlap With HandoffPolicy

HandoffPolicy entscheidet, ob und wann Uebergabe vorbereitet wird:

- `requiredBeforeHandoff`,
- `summarizeBeforeHandoff`,
- `fallbackBehavior`,
- Prepare-/Defer-Entscheidung,
- Post-Capture-Aktion.

DeliveryPayload darf nur die Nutzlast fuer eine bereits entschiedene Zustellung bauen. NotificationSafetyGuard darf nur blockieren oder no-op modellieren, wenn die Zustellung unsicher, unvollstaendig oder nicht konfiguriert ist.

## AssistantProfile Relevance

Aktuelle Relevanz:

- `assistantProfile.deliveryChannels` ist ein gespeichertes/Admin-Diagnose-Modell.
- `AssistantProfileResolverService` mapped Legacy-`leadNotificationEmail` auf `deliveryChannels.email`.
- `AssistantProfileSaveService` validiert `email`, `webhook` und `system`.
- Admin-Diagnose zeigt Channel-Typ, Enabled und Status, aber keine privaten Zielwerte.

Nicht aktuell:

- AssistantProfile ist nicht die Live-Conversation-Engine fuer das Public Widget.
- `deliveryChannels` aktivieren keine automatische Public-Widget-Delivery.
- Conversation Engine ist im Public Widget nicht aktiv.

Zukuenftig:

- `deliveryChannels.email.enabled` kann Delivery-Command-Building erlauben.
- `deliveryChannels.webhook.enabled` kann Webhook-Command-Building erlauben.
- `deliveryChannels.system.enabled` kann System-Handoff-Command-Building erlauben.
- Signing modes muessen weiterhin von Integration-Konfiguration und nicht von Public-Widget-Input kontrolliert werden.

## Proposed Boundary Services

### A. NotificationSafetyGuard

Zustaendig fuer:

- keine Payloads ohne Ziel,
- keine leeren Empfaenger oder Endpunkte,
- keine Secrets in Public-/Log-/Audit-Payloads,
- blockierte oder reservierte Header,
- no-op bei fehlender Konfiguration,
- Public-URL-Validierungsanforderung fuer Webhooks,
- keine Side Effects.

Nicht zustaendig fuer:

- Queue-Writes,
- externe HTTP-Aufrufe,
- Lead-/Ticket-Entscheidungen,
- Antworttext-Bau.

### B. DeliveryPayloadBuilder

Zustaendig fuer:

- `EmailJobPayload` bauen,
- `WebhookJobPayload` bauen,
- `SystemHandoffPayload` bauen,
- Payloads normalisieren und sanitizen,
- keine Ausfuehrung,
- keine Queue-Writes.

### C. DeliveryCommandBuilder

Zustaendig fuer:

- `DeliverySideEffectCommand` Datenobjekte bauen,
- no-op Commands bei fehlender Konfiguration,
- Fehler-/Risk-Reason-Codes als Daten modellieren,
- Orchestrator bleibt Executor.

### D. DeliveryExecutorService, spaeter

Zustaendig fuer:

- `email_jobs` schreiben,
- `webhook_jobs` schreiben,
- externe Integration ausloesen,
- Worker-/Retry-Grenzen koordinieren.

Erst nach separatem Audit und starker Testabdeckung.

## SideEffect Command Model

Moegliches fruehes Datenmodell:

```ts
type DeliverySideEffectCommand =
  | { type: 'queue_email_job'; payload: EmailJobPayload }
  | { type: 'queue_webhook_job'; payload: WebhookJobPayload }
  | { type: 'prepare_system_handoff'; payload: SystemHandoffPayload }
  | { type: 'record_delivery_audit'; payload: DeliveryAuditPayload }
  | { type: 'update_metadata'; patch: Record<string, unknown> }
  | { type: 'noop_delivery'; reasonCode: string };
```

Regeln:

- fruehe Phasen bauen nur Commands,
- Orchestrator oder bestehende Services fuehren weiter aus,
- keine versteckten Side Effects,
- Commands enthalten keine rohen Secrets fuer Public-/Audit-Ausgabe,
- HMAC Secrets bleiben in Integration-/WebhookJob-Grenzen.

## Refactor Phases

### Phase 1: Pure NotificationSafetyGuard

- reine Helper extrahieren,
- Ziel-/Header-/Secret-Safety pruefen,
- no-op Reason-Codes bauen,
- keine DB-/Queue-Writes,
- keine Antworttexte aendern.

### Phase 2: DeliveryPayloadBuilder

- Email-, Webhook- und System-Payload-Builder extrahieren,
- Payloads sanitizen,
- keine Ausfuehrung,
- keine Queue-Writes.

### Phase 3: DeliverySideEffectCommand Builder

- Delivery Commands als Datenobjekte bauen,
- Orchestrator bleibt Executor,
- keine externen Integrationen.

Status: umgesetzt und production-validiert in P1.2B-9 fuer reine Lead-/Email-Command-Datenobjekte. Echte Queue-Writes und Delivery-Ausfuehrung bleiben ausserhalb dieser Phase.

### Phase 4: DeliveryExecutionBoundary

- Delivery Commands klassifizieren,
- E-Mail-Queue-Commands validieren,
- ExecutionPlan-Datenobjekte bauen,
- audit-/log-safe ExecutionPlan-Projektionen bereitstellen,
- keine Ausfuehrung,
- keine Queue-Writes.

Status: umgesetzt und production-validiert in P1.2B-10 fuer reine Validation-/ExecutionPlan-Datenobjekte. Echte Queue-Writes, Orchestrator-Wiring und Delivery-Ausfuehrung bleiben ausserhalb dieser Phase.

### Phase 5: EmailDeliveryExecutor Boundary

- Email Delivery Plans klassifizieren,
- Email Delivery Plans validieren,
- Result-Datenobjekte fuer `ready`, `skipped`, `blocked` und `failed` bauen,
- audit-/log-safe Result-Projektionen bereitstellen,
- keine Ausfuehrung,
- keine Queue-Writes,
- kein Worker-/SMTP-Verhalten.

Status: umgesetzt und production-validiert in P1.2B-11 fuer reine Validation-/Result-Datenobjekte. Echte Queue-Writes, `EmailJobsService.enqueue`, Orchestrator-Wiring, Worker-/SMTP-Ausfuehrung und Delivery-Ausfuehrung bleiben ausserhalb dieser Phase.

### Phase 6: EmailQueueWriteBoundary

- Source Delivery Results klassifizieren,
- Queue Write Requests validieren,
- Queue Write Result-Datenobjekte fuer `ready`, `skipped`, `blocked` und `failed` bauen,
- audit-/log-safe Request-/Result-Projektionen bereitstellen,
- keine Ausfuehrung,
- keine Queue-Writes,
- kein `EmailJobsService.enqueue`,
- kein `EmailJobsService.processPendingJobs`,
- kein Worker-/SMTP-Verhalten.

Status: umgesetzt und production-validiert in P1.2B-12 fuer reine Validation-/Request-/Result-Datenobjekte. Echte Queue-Writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator-Wiring, Worker-/SMTP-Ausfuehrung und Delivery-Ausfuehrung bleiben ausserhalb dieser Phase.

### Phase 7: EmailJobPersistenceBoundary

Status: umgesetzt und production-validiert in P1.2B-13 fuer reine PersistenceRequest-/PersistenceResult-Datenobjekte. Echte `email_jobs` Writes/Updates, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator-Wiring, Worker-/SMTP-Ausfuehrung und Delivery-Ausfuehrung bleiben ausserhalb dieser Phase.

### Phase 8: EmailJobProcessingTriggerBoundary

Status: umgesetzt und production-validiert in P1.2B-14 fuer reine ProcessingTriggerRequest-/ProcessingTriggerResult-Datenobjekte. Echte Processing-Ausfuehrung, `processPendingJobs`, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Worker-/SMTP-Ausfuehrung, Retry-/Status-/Locking-Verhalten und `report_runs` Sync bleiben ausserhalb dieser Phase.

### Phase 9: EmailJobWorkerBoundary

Status: umgesetzt und production-validiert in P1.2B-15 fuer reine WorkerPlan-/WorkerResult-Datenobjekte. Echte Worker-Ausfuehrung, `processPendingJobs`, SQL, DB reads/writes, `email_jobs` Reads/Writes/Updates, Worker-/SMTP-Ausfuehrung, Retry-/Status-/Locking-Verhalten, stale-processing-Recovery und `report_runs` Sync bleiben ausserhalb dieser Phase.

### Phase 10: EmailJobStatusPolicyBoundary

Status: umgesetzt und production-validiert in P1.2B-16 fuer reine StatusTransitionPolicy-/RetryPolicy-/LockingPolicy-/StaleProcessingPolicy-/PolicyResult-Datenobjekte. Echte Status-/Retry-/Locking-Ausfuehrung, stale-processing-Recovery, SQL, DB reads/writes, `email_jobs` Reads/Writes/Updates, `processPendingJobs`, Worker-/SMTP-Ausfuehrung und `report_runs` Sync bleiben ausserhalb dieser Phase.

### Phase 11: Boundary Tests erweitern

- Public Widget Response Shape,
- keine unerwarteten Jobs,
- Header-/Secret-Sanitizing,
- AssistantProfile deliveryChannels no-op.

### Phase 12: Optionaler DeliveryExecutorService

- nur nach separatem Audit,
- nur mit Worker-/Retry-/Audit-Testabdeckung,
- nicht in P1.2B-7B.

## Required Tests

### NotificationSafetyGuard

- kein Payload ohne Ziel,
- kein Payload mit leerem Ziel,
- kein Secret in Public-/Log-/Audit-Payload,
- unsichere Header werden entfernt oder blockiert,
- reservierte Webhook-Signature-Header bleiben blockiert,
- no-op bei fehlender Konfiguration.

### Delivery Payloads

- E-Mail-Job nur mit gueltigem Ziel,
- Webhook-Job nur mit gueltiger URL/config,
- Payload enthaelt keine Secrets,
- Webhook-Signing-Metadaten werden referenziert, aber Secret wird nicht geleakt,
- disabled delivery channel erzeugt kein Command,
- HMAC-Modus sendet keinen Legacy-Secret-Header.

### Regression

- Lead Capture bleibt kompatibel,
- Ticket Flow bleibt kompatibel,
- HandoffPolicy bleibt kompatibel,
- Public Widget Response Shape unveraendert,
- keine unerwarteten `email_jobs` oder `webhook_jobs`,
- keine externen Integrationen ohne expliziten Pfad,
- Admin-/Diagnostics-Responses bleiben sanitized.

## Non-goals

- keine Conversation Engine Live-Aktivierung,
- keine AssistantProfile-Migration,
- keine Feature Flags,
- keine Public Widget Response Aenderung,
- keine DB-Migration,
- keine neue Delivery-Logik,
- keine E-Mail-/Webhook-Aenderung,
- keine Antworttext-Modernisierung,
- kein Verschieben von DB-/Queue-Writes in fruehen Phasen,
- kein Zusammenlegen von ToolExecutor/ToolDispatcher,
- kein automatisches Aktivieren von `deliveryChannels`,
- kein `DeliveryExecutorService` in P1.2B-7B.

## Recommended Next Step

P1.2B-7, P1.2B-8, P1.2B-9, P1.2B-10, P1.2B-11, P1.2B-12, P1.2B-13, P1.2B-14, P1.2B-15 und P1.2B-16 sind umgesetzt und production-validiert. Der naechste empfohlene Schritt ist `P1.2B-17A` Email Jobs DB Schema / Idempotency Key Audit.

P1.2B-17A sollte nur Audit / Scope bleiben und keine Queue-Writes verschieben, keinen Executor-Code einfuehren, keine Webhooks einbeziehen, keine externen Integrationen ausloesen und keine Public Widget Response aendern. Der Audit sollte DB schema/indexes, semantic idempotency keys, duplicate detection, migration/backfill risk, rollout strategy, rollback strategy, `report_runs` interaction, safe logging/redaction und erforderliche DB-Tests abdecken.
## P1.2B-17 Status Note

P1.2B-17 implemented and production-validated `EmailJobIdempotencyBoundary` as a pure idempotency, dedupe, schema-plan, backfill-risk, validation, and safe-projection data-object layer.

No DB migration, SQL, DB reads or writes, `email_jobs` reads/writes/updates, idempotency enforcement, backfill, unique index, constraint, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, Worker/SMTP change, `report_runs` change, NOLIS-specific logic, or production wiring was introduced. Those areas remain deferred.

## P1.2B-18 Status Note

P1.2B-18 implemented and production-validated `EmailJobIdempotencyMigrationPlanBoundary` as a pure enforcement-plan, migration-phase, unique-index-plan, backfill-plan, duplicate-conflict-policy, rollback-plan, validation, result-data, and safe-projection layer.

No DB migration, SQL, DB reads or writes, `email_jobs` reads/writes/updates, idempotency enforcement, unique index, constraint, backfill, existing duplicate cleanup, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, Worker/SMTP change, `report_runs` change, NOLIS-specific logic, or production wiring was introduced. Those areas remain deferred. Production validation is yellow only because `production-health-synthetic` still returns widget config HTTP 404.

## P1.2B-19 Status Note

`EmailJobDuplicateAuditPlanBoundary` was implemented in P1.2B-19 as a pure duplicate-audit and cleanup-plan data-object layer and production-validated.

DB reads, SQL, `email_jobs` reads/writes/updates, duplicate cleanup, backfill, unique index or constraint work, idempotency enforcement, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs`, Orchestrator wiring, worker/SMTP execution, `report_runs` synchronization, webhooks, ToolExecutor/ToolDispatcher work, IntegrationDispatcher work, and Production wiring remain deferred.
