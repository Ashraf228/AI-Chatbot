# IT Support Ticket Flow Audit

Datum: 2026-07-03
Scope: Read-only Micro-Audit zur spaeteren Extraktion eines `ItSupportTicketFlowService` aus der Live-Chatlogik. Keine Code-, Deploy-, Migrations-, Feature-Flag-, Production-Config- oder Public-Widget-Aenderung.

## Summary

Der IT-Support-/Ticket-Flow liegt aktuell weiterhin im `ChatAgentOrchestratorService`. Er kapselt nicht nur Routing und Ticket-Feldsammlung, sondern auch Statusuebergaenge, Antworttexte, `conversation.metadata`-Patches und die finale Ausloesung von `ToolExecutorService.executeTool('create_ticket')`.

Die echten Ticket-Side-Effects liegen nicht in reinen Helpern:

- `ChatAgentOrchestratorService` entscheidet, wann ein Ticket erstellt werden darf.
- `ToolExecutorService` schreibt `agent_tickets`, aktualisiert Ticket-Metadata und dispatcht Integrationsereignisse.
- `ToolDispatcherService` hat einen separaten Agent-/Tool-Pfad fuer Ticket-Erstellung und Webhook-Forwarding.

Eine risikoarme Extraktion sollte deshalb zuerst nur die reine IT-Ticket-Entscheidung, Feldsammlung und Payload-Erzeugung kapseln. DB-Schreiboperationen, Queue-/Webhook-Dispatch, Audit-/Integration-Events und finale Public-Widget-Antworten sollten zunaechst sichtbar im Orchestrator beziehungsweise in den bestehenden Tool-Services bleiben.

## Relevant Files

| Datei | Rolle im IT-/Ticket-Kontext |
| --- | --- |
| `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Zentrale Live-Entscheidung fuer IT-Support, Ticket-State-Machine, Ticket-Feldsammlung, Metadata-Persistenz und ToolExecutor-Aufruf |
| `apps/api/src/chat/contact-collection.helpers.ts` | Bereits extrahierte reine Kontakt-Helfer; teilt sich Name, E-Mail, Telefon und Pflichtfeldlogik mit Ticket-Flows |
| `apps/api/src/chat/local-service-legacy.helpers.ts` | Bereits extrahierte reine Local-Service-Helfer; muss vom IT-Ticket-Flow getrennt bleiben |
| `apps/api/src/chat/legacy-routing.guard.ts` | Abgrenzung zwischen Universal, explizitem Legacy-/Local-Service und anderen Spezialpfaden |
| `apps/api/src/modules/widget/services/widget-chat.service.ts` | Public Widget Entry; darf keine Ticket-Debug- oder Preview-Felder oeffentlich ausgeben |
| `apps/api/src/ai/chat-pipeline/conversation-state.service.ts` | Persistiert Conversation, Messages und Widget Session ausserhalb des Orchestrators |
| `apps/api/src/ai/chat-pipeline/response-composer.service.ts` | Baut allgemeine Antworten/Guides; darf Public Response Shape nicht veraendern |
| `apps/api/src/assistant-profiles/assistant-profile-resolver.service.ts` | Liefert AssistantProfile read-only; Live-Ticket-Flow nutzt es noch nicht als aktive Entscheidungsquelle |
| `apps/api/src/tools/tool-executor.service.ts` | Fuehrt `create_ticket` fuer den Live-/ToolExecutor-Pfad aus und erzeugt echte Ticket-Side-Effects |
| `apps/api/src/tools/tool-dispatcher.service.ts` | Separater Agent-/ToolDispatcher-Ticket-Pfad mit eigener Insert-/Webhook-Logik |
| `apps/api/test/chat-agent-orchestrator.service.test.cjs` | Hauptabdeckung fuer IT-Support-Ticketfluss, PendingTicket-Zustaende, Sicherheit, Dedupe und Weiterleitung |
| `apps/api/test/widget-chat-flow.test.cjs` | Public Widget Response Shape und keine oeffentlichen Debug-Felder |
| `apps/api/test/contact-collection-helpers.test.cjs` | Regression fuer Kontakt-Helfer, relevant wegen Reporter-Feldern |
| `apps/api/test/legacy-routing-guard.test.cjs` | Regression fuer Legacy-/Universal-Abgrenzung |

## Current IT Ticket Flow Map

1. `WidgetChatService` validiert Site, Origin und Session und ruft die Chat-Pipeline.
2. `ChatPipelineService` laedt oder erzeugt Conversation/Message-Kontext und ruft `ChatAgentOrchestratorService.decide`.
3. `decide` laedt Site-/Module-Konfiguration und `conversations.metadata`.
4. `getModuleContext` erkennt das `it-support`/`it_support` Modul und normalisiert die IT-Support-Konfiguration.
5. `handleItSupportFlow` entscheidet, ob der IT-Pfad aktiv ist:
   - aktives `pendingTicket`
   - explizites Ticket-/Handoff-Signal
   - IT-Support-Signal
   - kritischer oder Security-bezogener Vorfall
6. Der Flow arbeitet statusbasiert:
   - `solution_offered`
   - `ticket_offered`
   - `collecting`
   - `ready_to_create`
   - `created`
   - `cancelled`
   - `resolved`
7. `collectItSupportTicketFields` sammelt fehlende Ticketfelder und setzt `pendingTicket`, `conversationState`, `missingFields`, `nextExpectedField` und `lastAssistantAsk`.
8. Erst nach finaler Bestaetigung ruft der Orchestrator `ToolExecutorService.executeTool('create_ticket')` auf.
9. `ToolExecutorService` erzeugt den echten `agent_tickets`-Datensatz, aktualisiert Metadata und dispatcht das `ticket.created` Ereignis.
10. Der Orchestrator speichert den finalen `pendingTicket`-Status und gibt die bestehende Public-Widget-Antwort zurueck.

## Responsibility Matrix

| Methode/Funktion | Datei | Verantwortung | liest Metadata | schreibt Metadata | erzeugt Side Effects | Antworttext | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `handleItSupportFlow` | `chat-agent-orchestrator.service.ts` | IT-Ticket-State-Machine, Routing, Sicherheits-/Prioritaetssignale, Consent, Finalisierung | Ja | Ja | Ja, final ueber ToolExecutor | Ja | Sehr hoch |
| `collectItSupportTicketFields` | `chat-agent-orchestrator.service.ts` | Fehlende Ticketfelder bestimmen, `pendingTicket` auf `collecting` oder `ready_to_create` setzen | Ja | Ja | Metadata-Write | Ja | Hoch |
| `isActivePendingTicket` | `chat-agent-orchestrator.service.ts` | Erkennt, ob ein gespeichertes Ticket weitergefuehrt werden darf | Ja | Nein | Nein | Nein | Mittel |
| `shouldStartNewItSupportContext` | `chat-agent-orchestrator.service.ts` | Entscheidet, ob ein alter Ticketkontext ignoriert und ein neuer Kontext gestartet wird | Ja | Nein | Nein | Nein | Hoch |
| `hasItSupportSignal` / `hasExplicitTicketRequest` / `hasItSupportHandoffRequest` | `chat-agent-orchestrator.service.ts` | Signalisiert IT-Support, Ticketwunsch oder Uebergabewunsch | Nein | Nein | Nein | Nein | Hoch |
| `hasCriticalItIncident` / `hasSecurityIncident` | `chat-agent-orchestrator.service.ts` | Erkennt kritische und sicherheitsrelevante Vorfaelle | Nein | Nein | Nein | Sicherheitswarnung indirekt | Hoch |
| `extractItTicketFields` | `chat-agent-orchestrator.service.ts` | Extrahiert Ticketfelder aus User-Nachricht und bisherigem Ticketkontext | Ja | Nein | Nein | Nein | Hoch |
| `mergePendingTicket` | `chat-agent-orchestrator.service.ts` | Fuehrt bestehenden `pendingTicket`-State und neue Felder zusammen | Ja | Nein | Nein | Nein | Mittel |
| `getMissingItTicketFields` | `chat-agent-orchestrator.service.ts` | Ermittelt fehlende Pflichtfelder aus IT-Support-Konfiguration | Ja | Nein | Nein | Indirekt | Hoch |
| `mapTicketMissingFieldToAssistantAsk` | `chat-agent-orchestrator.service.ts` | Mapped fehlende Felder auf `lastAssistantAsk` / naechste Rueckfrage | Ja | Nein | Nein | Indirekt | Mittel |
| `buildTicketConversationState` | `chat-agent-orchestrator.service.ts` | Baut `conversationState` fuer Ticket-Intent, Stage, Goal, Felder und naechste Erwartung | Ja | Nein | Nein | Nein | Hoch |
| `buildCreateTicketInputFromPendingTicket` | `chat-agent-orchestrator.service.ts` | Baut ToolExecutor-Payload fuer `create_ticket` aus `pendingTicket` | Ja | Nein | Tool-Input fuer Side Effect | Nein | Hoch |
| `buildItTicketMissingFieldQuestion` | `chat-agent-orchestrator.service.ts` | Baut bestehende Rueckfrage fuer fehlende Ticketfelder | Nein | Nein | Nein | Ja | Hoch |
| `buildItTicketReadyToCreateAnswer` | `chat-agent-orchestrator.service.ts` | Baut finale Bestaetigungsfrage vor Ticketanlage | Nein | Nein | Nein | Ja | Hoch |
| `buildCreatedItTicketAnswer` | `chat-agent-orchestrator.service.ts` | Baut Antwort nach erfolgreicher Ticketanlage inklusive Weiterleitungsstatus | Ja | Nein | Nein | Ja | Sehr hoch |
| `buildItTicketOfferAnswer` / `buildItTicketCancelledAnswer` / `buildItSupportResolvedAnswer` | `chat-agent-orchestrator.service.ts` | Bestehende Antworten fuer Angebot, Abbruch und geloesten Fall | Ja | Nein | Nein | Ja | Hoch |
| `withItSecurityWarning` | `chat-agent-orchestrator.service.ts` | Ergaenzt sicherheitsrelevante Warnung bei kritischen/security Signalen | Nein | Nein | Nein | Ja | Hoch |
| `saveConversationMetadata` | `chat-agent-orchestrator.service.ts` | Persistiert `pendingLead`, `pendingTicket` und `conversationState` in JSONB | Ja | Ja | DB write | Nein | Sehr hoch |
| `ToolExecutorService.executeTool('create_ticket')` | `tool-executor.service.ts` | Fuehrt echte Ticketanlage aus dem Live-/ToolExecutor-Pfad aus | Ja | Ja | `agent_tickets`, Metadata, Integration Event | Tool-Result | Sehr hoch |
| `ToolDispatcherService` Ticket-Pfad | `tool-dispatcher.service.ts` | Separater Agent-/ToolDispatcher-Pfad fuer Ticketanlage und Webhook-Forwarding | Ja | Ja | `agent_tickets`, Webhook-Job, Metadata | Tool-Result | Sehr hoch |

## Metadata and State Usage

### `pendingTicket`

Der IT-Flow verwendet `pendingTicket` als zentrale Statusquelle. Relevante Felder:

- `status`
- `issueType`
- `affectedSystem`
- `impact`
- `urgency`
- `priority`
- `reporterName`
- `reporterEmail`
- `reporterPhone`
- `device`
- `operatingSystem`
- `errorMessage`
- `alreadyTried`
- `department`
- `missingFields`
- `nextExpectedField`
- `lastAssistantAsk`
- `ticketConsent`
- `createdTicketId`
- `forwardingStatus`

### `conversationState`

Der Ticket-Flow baut einen eigenen Conversation State:

- `intent: ticket`
- `goal: create_ticket`
- `topic`
- `stage`
- `urgency`
- `collectedFields`
- `missingFields`
- `nextExpectedField`
- `lastUserIntent`
- `updatedAt`

### `pendingLead`

Der IT-Ticket-Flow setzt `pendingLead` in seinen Metadata-Patches bewusst auf `null`, damit Ticket- und Lead-Pfade nicht parallel konkurrieren.

## Side Effects

### Bleiben im Orchestrator

- Entscheidung, ob Ticketanlage erlaubt ist
- Metadata-Persistenz ueber `saveConversationMetadata`
- ToolExecutor-Aufruf erst nach finaler Bestaetigung
- Public-Widget-Antwortauswahl

### Liegen im ToolExecutor

- Insert in `agent_tickets`
- Conversation-Metadata Update mit Ticket-ID
- `ticket.created` Integration Event
- Forwarding-/Webhook-Status in Ticket-Metadata
- Rueckgabe von `ticketId`, `status`, `forwardingStatus` und weiteren Ticketfeldern

### Liegen im ToolDispatcher

- separater Agent-/ToolDispatcher-Ticketpfad
- eigener `agent_tickets` Insert
- optionales Webhook-Forwarding
- eigene Metadata-Updates

Ein spaeterer `ItSupportTicketFlowService` darf diese Side Effects nicht implizit ausfuehren. Er sollte maximal Commands oder Payloads erzeugen, die der Orchestrator explizit ausfuehrt.

## Overlap with Contact Collection

Der Ticket-Flow teilt sich mehrere Feldarten mit der bereits extrahierten Contact Collection:

- Name
- E-Mail
- Telefon
- Anliegen / Request
- Prioritaet
- Rueckruf- oder Terminwunsch als moeglicher Kontaktkontext

Ticket-spezifisch bleiben:

- Supportfall / Issue
- Kategorie
- technische Umgebung
- Geraet
- betroffene Komponente
- Fehlermeldung
- bereits versuchte Schritte
- Auswirkung / Impact
- `agent_tickets`
- Ticket-Status und Ticket-Weiterleitung

Spaeter gemeinsam nutzbar sind vor allem Kontakt-Extraktion, sichere Feldnormalisierung und einfache Pflichtfeldpruefung. Nicht gemeinsam genutzt werden sollten Statusmaschine, Antworttexte, Ticket-Payloads und Side-Effect-Commands. Eine zu breite Extraktion koennte sonst Lead Capture, Local-Service Legacy und IT-Ticket-Verhalten vermischen.

## Overlap with LeadCapture / Handoff

Lead Capture, Handoff und Ticket Flow haben aehnliche Oberflaechen, aber unterschiedliche Side Effects.

Lead Capture:

- allgemeine Anfrage / Kontakt
- `widget_leads`
- optionale `email_jobs` / `webhook_jobs`
- Lead-Audit und Lead-Benachrichtigung

Ticket Flow:

- support-/IT-spezifische Felder
- `agent_tickets`
- Ticket-Prioritaet
- Ticket-Status
- Ticket-Weiterleitungsstatus

Handoff:

- Uebergabe an Team oder System
- `deliveryChannels`
- `summaryBeforeHandoff`
- optional E-Mail, Webhook oder Systemuebergabe

Ein `ItSupportTicketFlowService` sollte deshalb keine Lead-Capture- oder allgemeine Handoff-Logik uebernehmen. Falls spaeter Benachrichtigungen fuer Tickets modelliert werden, sollten diese als eigene `TicketSideEffectCommand`s sichtbar bleiben und nicht als Lead-Notification wiederverwendet werden.

## AssistantProfile Relevance

Der Live-Ticket-Flow nutzt `AssistantProfile` derzeit nicht als aktive Entscheidungsquelle. Relevant fuer eine spaetere Integration sind aber:

- `assistantProfile.enabledTasks`
- `assistantProfile.requiredFields`
- `assistantProfile.handoffRules`
- `assistantProfile.deliveryChannels`
- `site_modules["assistant-profile"]`
- `sites.config.botType`
- `sites.config.industry`
- `sites.config.conversationFlow`

Heutige Quellen fuer Ticket-/Support-Verhalten sind primaer:

- aktiviertes `it-support` / `it_support` Modul
- normalisierte IT-Support-Modulkonfiguration
- `pendingTicket` in `conversations.metadata`
- Ticket- und IT-Support-Signale aus der User-Nachricht

Legacy-Quellen wie `botType`, `industry` und alte Conversation-Flow-Felder bleiben fuer Rueckwaertskompatibilitaet relevant, sollten aber nicht direkt in einen neuen Ticket-Service hineinwachsen. Der Orchestrator sollte dem spaeteren Service einen bereits normalisierten Kontext uebergeben: Site, Tenant, Conversation, IT-Support-Konfiguration, optionales AssistantProfile, `pendingTicket` und `conversationState`.

Dieses Audit gibt keine Freigabe, die Conversation Engine im Public Widget zu aktivieren. Es dokumentiert nur, welche Konfiguration spaeter fuer Ticket-Entscheidungen relevant werden kann.

## Public Widget and Response Risks

- Bestehende Antworttexte sind produktionssichtbar und textsensitiv.
- Der finale Tickettext darf keinen falschen Weiterleitungsstatus behaupten.
- Security-/kritische Vorfallwarnungen sind sicherheitsrelevant.
- Ein bereits erstelltes Ticket darf bei erneutem "ja" nicht doppelt erzeugt werden.
- Generische Termin-, Mitarbeiter- oder Produktfragen duerfen nicht versehentlich in den Ticketpfad fallen.
- Public Widget Response darf keine Debug-, Preview-, Compare-, Knowledge- oder interne Ticketfelder erhalten.

## Proposed ItSupportTicketFlowService Boundary

### Sollte enthalten

- IT-/Ticket-Signalentscheidung
- PendingTicket-Statusauswertung
- Ticket-Feldextraktion
- PendingTicket-Merge
- Missing-Field-Ermittlung
- Ticket-Conversation-State-Building
- ToolExecutor-Payload-Building
- Side-Effect-Command-Building ohne Ausfuehrung
- Antwortauswahl nur, wenn bestehende Texte byte-identisch bleiben

### Sollte nicht enthalten

- DB-Schreiboperationen
- `saveConversationMetadata`
- `ToolExecutorService.executeTool`
- `agent_tickets` Insert
- Webhook-/Integration-Dispatch
- ToolDispatcher-Ticketpfad
- Public Widget Controller/Response Shape
- AssistantProfile-Live-Aktivierung
- Conversation-Engine-Live-Aktivierung

### Empfohlenes Interface

```ts
class ItSupportTicketFlowService {
  canHandle(input: ItSupportTicketFlowInput): boolean;
  collectTicketFields(input: ItSupportTicketFlowInput): TicketCollectionResult;
  buildTicketPayload(input: ItSupportTicketFlowInput): AgentTicketPayload;
  buildTicketSideEffectCommands(input: ItSupportTicketFlowInput): TicketSideEffectCommand[];
  finalizeTicket(input: ItSupportTicketFlowInput): TicketFlowResult;
  buildMissingTicketFieldPrompt(field: string, context: ItSupportTicketFlowInput): string;
  buildFailureResult(error: unknown): TicketFlowResult;
}

type ItSupportTicketFlowInput = {
  tenantId: string;
  siteId: string;
  conversationId: string;
  message: string;
  pendingTicket: PendingTicketState | null;
  conversationState: ConversationState | null;
  itSupportConfig: ItSupportModuleConfig | null;
};

type ItSupportTicketFlowResult = {
  handled: boolean;
  action: ChatAgentDecision['action'];
  answer?: string;
  metadataPatch?: {
    pendingLead?: null;
    pendingTicket?: PendingTicketState | null;
    conversationState?: ConversationState;
  };
  createTicketCommand?: {
    toolName: 'create_ticket';
    input: Record<string, unknown>;
    context: {
      tenantId: string;
      siteId: string;
      conversationId: string;
      source: 'widget';
      agentKey: 'it-support-agent';
      moduleKey: 'it-support';
    };
  };
  warnings?: string[];
};
```

## SideEffect Command Model

Ein sicheres fruehes Modell benennt moegliche Side Effects explizit:

```ts
type TicketSideEffectCommand =
  | { type: "insert_agent_ticket"; payload: AgentTicketPayload }
  | { type: "update_metadata"; patch: Record<string, unknown> }
  | { type: "record_ticket_audit"; payload: TicketAuditPayload }
  | { type: "queue_ticket_notification"; payload: EmailJobPayload | WebhookJobPayload };

type TicketFlowResult = {
  completed: boolean;
  responseText?: string;
  metadataPatch?: Record<string, unknown>;
  sideEffectCommands: TicketSideEffectCommand[];
  reasonCode: string;
  error?: string;
};
```

Fruehe Phasen sollten keine versteckten DB-Writes enthalten. Der Orchestrator bleibt zunaechst Executor und entscheidet, wann Metadata, `agent_tickets`, Benachrichtigungen oder Tool-Aufrufe tatsaechlich ausgefuehrt werden.

## Recommended Extraction Phases

### Phase 1: Pure Ticket Field Helper

- Neue Datei z. B. `apps/api/src/chat/it-support-ticket.helpers.ts`.
- Signal-Erkennung, Status-Pruefung und Field Extraction extrahieren.
- Keine Injectable-Abhaengigkeiten.
- Keine DB-Writes, Queue-Writes oder Antworttextaenderungen.

### Phase 2: Ticket Missing-Field Helper

- Missing Fields, Field Labels und naechste Rueckfrage extrahieren.
- Antworttexte exakt beibehalten.
- Keine Public Widget Response Shape Aenderung.

### Phase 3: Ticket Payload Builder

- ToolExecutor-/AgentTicket-Payload aus `pendingTicket` bauen.
- Keine DB-Writes.
- Keine Ticketanlage ohne finale Bestaetigung.

### Phase 4: Ticket SideEffectCommand Builder

- Commands wie `insert_agent_ticket`, `update_metadata` und optionale Benachrichtigung beschreiben.
- Orchestrator fuehrt Commands weiter aus.
- Keine versteckten Side Effects.

### Phase 5: `ItSupportTicketFlowService.tryHandle(...)`

- `ItSupportTicketFlowService.evaluate(input)` erzeugt `ItSupportTicketFlowResult`.
- Orchestrator bleibt verantwortlich fuer:
  - `saveConversationMetadata`
  - `ToolExecutorService.executeTool`
  - Fehlerbehandlung
  - finale Public-Widget-Antwort

### Phase 6: Optionaler DB-/Queue-Executor-Service

- Nur mit starker Testabdeckung.
- `ToolExecutorService` und `ToolDispatcherService` vorher separat auditieren.
- Erst danach entscheiden, ob gemeinsame Ticket-Payload-Builder sinnvoll sind.

## Required Tests

- IT-Support Wissensantwort bleibt zuerst loesungsorientiert und erstellt kein Ticket.
- Fehlgeschlagene Loesung bietet Ticketanlage an.
- Direkter Ticketwunsch sammelt Pflichtfelder, erstellt aber vor finaler Bestaetigung kein Ticket.
- `ready_to_create` + finale Bestaetigung erstellt genau ein `agent_tickets`-Ticket.
- Wiederholte Bestaetigung nach `created` erzeugt kein zweites Ticket.
- Abbruch und geloester Fall setzen `cancelled` beziehungsweise `resolved`.
- Custom Required Fields bleiben unveraendert.
- Kritische und Security-bezogene Vorfaelle behalten Warnung und Prioritaet.
- Reporter-Felder bleiben tenant-/site-isoliert.
- Sensitive IT-Daten werden nicht in Ticket/Metadata uebernommen.
- Weiterleitungsstatus `queued`, `not_configured`, `failed` und `unknown` bleiben in Antworttexten korrekt.
- Generische Termin-, Mitarbeiter- und Produktfragen starten keinen Ticketflow.
- `pendingLead` bleibt im Ticketpfad `null`.
- Public Widget Response Shape bleibt unveraendert.
- `ToolExecutorService`- und `ToolDispatcherService`-Tests bleiben unveraendert gruen.

## Non-goals

- Keine Runtime-Codeaenderung in diesem Audit.
- Keine Antworttextaenderung.
- Keine Side-Effect-Aenderung.
- Keine Migration.
- Keine Feature-Flag-Aktivierung.
- Keine AssistantProfile-Migration.
- Keine Conversation Engine im Public Widget.
- Keine Public Widget Response Erweiterung.
- Keine Vereinheitlichung von `ToolExecutorService` und `ToolDispatcherService`.

## Recommended Next Step

P1.2B-5B sollte zuerst reine IT-Support-/Ticket-Helper extrahieren. Die Ausfuehrung von `saveConversationMetadata`, `ToolExecutorService.executeTool('create_ticket')`, DB-Schreiboperationen, Webhook-/Integration-Dispatch und Public-Widget-Antwortassembly sollte im ersten Implementierungsschritt unveraendert bleiben.

## Implementation Status

Dieses Dokument ist nur das P1.2B-5A Audit. Die Implementierung ist noch nicht gestartet.
