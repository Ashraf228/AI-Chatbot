# Lead Capture Flow Audit

## Summary

Lead Capture sitzt aktuell primär im `ChatAgentOrchestratorService`. Dieser Bereich ist nicht pure, weil DB-Inserts, Usage-Limits, Conversation-Metadata, Audit, Mail-Queue und Contact Requests im selben Ablauf zusammenkommen.

Es gibt mindestens drei Lead-Capture-Pfade:

- Legacy-Orchestrator
- `ToolExecutorService`
- `ToolDispatcherService`

P1.2B-4B soll zunächst nur den Legacy-Orchestrator-Pfad kapseln. `ToolExecutorService` und `ToolDispatcherService` werden später separat auditiert oder bewusst getrennt gehalten, damit keine unterschiedlichen Side-Effect-Pfade versehentlich vereinheitlicht werden.

## Current Responsibilities

### ChatAgentOrchestratorService

- Lead-Gate / Aktivierung Lead Flow
- PendingLead Start/Update
- Capture-Finalisierung
- `captureLead`
- `createContactRequest`
- `saveConversationMetadata`
- `recordLeadAudit`
- `queueInternalLeadNotification`

### Widget Config

- `leadCaptureEnabled`
- `leadNotificationEmail`

### ToolExecutorService

- separater Tool-basierter Lead-Capture-Pfad
- eigene Metadata-/Integration-Event-Logik

### ToolDispatcherService

- Agent-run-basierter Lead-Capture-Pfad
- eigene Lead-/Email-Job-Logik

## Responsibility Matrix

| Methode/Funktion | Datei | Verantwortung | liest Metadata | schreibt Metadata | erzeugt Side Effects | Antworttext | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `decide` Lead-Gate | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Aktiviert oder deaktiviert Lead Flow abhängig von Route, Legacy-Signalen, Contact-Status und Site-Konfiguration. | ja | indirekt | indirekt | ja | hoch |
| Pending Lead Start/Update | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Startet oder aktualisiert `pendingLead` und bereitet Contact Collection / Capture vor. | ja | ja | Audit möglich | ja | mittel |
| Capture Finalisierung | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Schließt Lead Capture ab, markiert Completion und erzeugt Acknowledgement. | ja | ja | ja | ja | hoch |
| `captureLead` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Dedupe, Usage-Limit, Insert in `widget_leads`, Session-Markierung. | ja | ja | ja | nein | hoch |
| `createContactRequest` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Erstellt Contact Request für Termin-/Rückruf-/Handoff-ähnliche Fälle. | ja | ja | ja | nein | mittel |
| `saveConversationMetadata` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Persistiert Patches für `pendingLead`, `pendingTicket` und `conversationState`. | ja | ja | ja | nein | hoch |
| `recordLeadAudit` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Schreibt Lead-bezogene Audit-Einträge ohne Antwortänderung. | ja | nein | ja | nein | mittel |
| `queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Baut interne Lead-Benachrichtigung und queued `email_jobs`, wenn konfiguriert. | ja | nein | ja | nein | hoch |
| Widget Config Read | `apps/api/src/modules/widget/services/widget-config.service.ts` | Liest Site-Konfiguration für öffentliche Widget-Config inklusive Lead Capture. | nein | nein | nein | nein | mittel |
| Widget Chat Entry | `apps/api/src/modules/widget/services/widget-chat.service.ts` | Übergibt Site- und Widget-Kontext in die Chat-Pipeline und formt öffentliche Response. | ja | indirekt | indirekt | ja | mittel |
| `ToolExecutorService` `captureLead` | `apps/api/src/tools/tool-executor.service.ts` | Separater Tool-Pfad für Lead-Erfassung und Integration-Events. | ja | ja | ja | toolabhängig | hoch |
| `ToolDispatcherService` `executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Agent-run-basierter Lead-Capture-Pfad mit Lead-/Email-Job-Logik. | ja | ja | ja | toolabhängig | hoch |

## Side Effects

Lead Capture berührt mehrere persistente oder operative Bereiche:

- `widget_leads`
- `email_jobs`
- `webhook_jobs`
- `agent_tickets`
- `conversations.metadata`
- Lead Audit
- Usage-Limit-Checks
- Session-Markierung
- Contact-Request-Erstellung
- Integration Events

Ein späterer `LeadCaptureFlowService` darf diese Side Effects nicht verstecken. Entweder bleiben sie im Orchestrator oder werden über explizite Commands/Result-Objekte sichtbar gemacht.

## Overlap with Contact Collection

Contact Collection ist bereits teilweise als pure Helper extrahiert:

- Felder extrahieren
- Felder mergen
- Missing Fields bestimmen
- PendingLead-/ConversationState-Objekte bauen
- Capture-ready Entscheidung vorbereiten

Lead Capture bleibt davon abgegrenzt:

- tatsächlich Lead speichern
- E-Mail-/Webhook-Jobs erzeugen
- Audit schreiben
- Completion/Acknowledgement finalisieren
- Fehlerfälle behandeln

## Overlap with Ticket / Handoff

Lead Capture, Ticket Flow und Handoff dürfen nicht vermischt werden.

Lead Capture:

- allgemeine Anfrage / Kontakt
- `widget_leads`
- `email_jobs` / `webhook_jobs`

Ticket Flow:

- `agent_tickets`
- IT-Support oder Supportfall
- Ticket-spezifische Felder

Handoff:

- Teamübergabe
- `deliveryChannels`
- `summaryBeforeHandoff`
- möglicherweise E-Mail, Webhook oder Systemübergabe

Ein späterer `LeadCaptureFlowService` darf nicht versehentlich Ticket- oder Handoff-Logik übernehmen.

## AssistantProfile Relevance

Für spätere Lead-Capture-Entscheidungen können mehrere Konfigurationsquellen relevant werden:

- `assistantProfile.requiredFields`
- `assistantProfile.enabledTasks`
- `assistantProfile.handoffRules`
- `assistantProfile.deliveryChannels`
- `sites.config.leadCaptureEnabled`
- `sites.config.leadNotificationEmail`
- `site_modules["lead-sales"]`
- `lead-sales.intakeFlow`

Dieses Audit gibt keine Freigabe, `AssistantProfile` als Public-Widget-Live-Engine zu aktivieren. Es dokumentiert nur, welche Konfiguration später für Lead Capture relevant werden kann.

## Proposed LeadCaptureFlowService Interface

Zielklasse:

```ts
class LeadCaptureFlowService {
  canCaptureLead(input: LeadCaptureInput): boolean;
  buildLeadPayload(input: LeadCaptureInput): LeadPayload;
  buildLeadSideEffectCommands(input: LeadCaptureInput): LeadSideEffectCommand[];
  finalizeLeadCapture(input: LeadCaptureInput): Promise<LeadCaptureResult>;
  buildAcknowledgement(input: LeadCaptureInput): string;
  buildFailureResult(error: unknown): LeadCaptureResult;
}
```

Empfohlenes frühes Modell:

```ts
type LeadSideEffectCommand =
  | { type: "insert_widget_lead"; payload: WidgetLeadPayload }
  | { type: "queue_email_job"; payload: EmailJobPayload }
  | { type: "queue_webhook_job"; payload: WebhookJobPayload }
  | { type: "record_audit"; payload: LeadAuditPayload }
  | { type: "update_metadata"; patch: Record<string, unknown> };
```

Das frühe Modell sollte Side Effects explizit benennen, nicht implizit verstecken. Dadurch kann der Orchestrator zunächst weiter die Ausführungsreihenfolge kontrollieren und die öffentliche Widget-Response unverändert lassen.

## Refactor Phases

1. `LeadCaptureFlowService` nur für den Legacy-Orchestrator-Pfad einführen.
2. Pure Payload-/Command-Builder extrahieren, ohne DB-Schreiboperationen zu verschieben.
3. Side-Effect-Ausführung optional in explizite Methoden verschieben, aber Result-Objekte und Fehlerzustände sichtbar halten.
4. `captureLead`, `createContactRequest`, `recordLeadAudit` und `queueInternalLeadNotification` einzeln mit Golden-/Regression-Tests verlagern.
5. `ToolExecutorService` und `ToolDispatcherService` separat auditieren, bevor deren Lead-Capture-Pfade angefasst werden.

## Required Tests

- Lead über mehrere Nachrichten erstellt genau einen `widget_leads`-Eintrag.
- Dedupe innerhalb derselben Session bleibt unverändert.
- Fehlende SMTP-/Mail-Konfiguration speichert den Lead, erzeugt keinen `email_jobs`-Eintrag und wirft keinen Fehler.
- Usage-Limit blockiert Capture ohne Lead-Insert.
- `pendingLead.completedLeadId` wird nach erfolgreichem Capture gesetzt.
- Audit enthält keine vollständigen Lead-Inhalte.
- Termin-/Rückrufintent erzeugt Contact Request wie bisher.
- Public Widget Response Keys bleiben unverändert.
- `ToolExecutorService`- und `ToolDispatcherService`-Tests bleiben grün.

## Non-goals

- Keine Aktivierung der Conversation Engine im Public Widget.
- Keine AssistantProfile-Migration.
- Keine Änderung an Antworttexten.
- Keine Änderung an Lead-/Ticket-/Handoff-Side-Effects.
- Keine Vereinheitlichung von Legacy-Orchestrator, `ToolExecutorService` und `ToolDispatcherService` in diesem Schritt.

## Recommended Next Step

P1.2B-4B sollte zuerst pure Lead-Capture-Payload- und Side-Effect-Command-Helper für den Legacy-Orchestrator-Pfad extrahieren. Die Ausführung der Side Effects und die öffentliche Widget-Response sollten zunächst im Orchestrator bleiben.

## Implementation Status

Implementation status for P1.2B-4 is tracked in `docs/architecture/chat-orchestrator-refactor-status.md`.
