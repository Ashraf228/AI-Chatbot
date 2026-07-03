# Contact Collection Flow Audit

Datum: 2026-07-03
Scope: Read-only Micro-Audit zur spaeteren Extraktion eines `ContactCollectionFlowService` aus der Live-Chatlogik. Keine Code-, Deploy-, Migrations-, Feature-Flag- oder Public-Widget-Aenderung.

## Summary

Die generische Kontakt- und Pflichtfeldsammlung liegt aktuell groesstenteils im `ChatAgentOrchestratorService`. Sie ist mit Lead Capture, Termin-/Rueckruf-Handoff, Local-Service-Legacy, IT-Ticket-Vorbereitung, `conversation.metadata`, Antworttexten und Side Effects verschraenkt.

Eine risikoarme Extraktion sollte deshalb nicht direkt DB- oder Queue-Operationen verschieben. Der erste sinnvolle Schritt ist ein reiner `ContactCollectionFlowService`, der aus Input, bisherigem `pendingLead`, `conversationState`, Intent-Signalen und Kontaktfeldern eine side-effect-freie Entscheidung erzeugt:

- naechste fehlende Felder
- naechster `pendingLead`-Patch
- naechster `conversationState`-Patch
- empfohlene Aktion: weiterfragen, pausieren, qualifizieren oder capture-ready
- Antworttext-Schluessel oder finaler bestehender Antworttext

Persistenz, Lead-Erzeugung, Audit, E-Mail-Queue und `agent_contact_requests` sollten zunaechst im Orchestrator bleiben.

## Relevant Files

| Datei | Rolle im Contact-Collection-Kontext |
| --- | --- |
| `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Zentrale Live-Entscheidung fuer generische Contact Collection, Pending Lead Lifecycle, Lead Capture, Schedule Contact Request, Audit und Antworttexte |
| `apps/api/src/chat/local-service-legacy.helpers.ts` | Bereits extrahierte reine Local-Service-Helfer fuer Missing Fields, Labels, Prompts und Validierung |
| `apps/api/src/chat/legacy-routing.guard.ts` | Explizite Local-Service-/Legacy-Erkennung, wichtig fuer Abgrenzung zwischen generischer Contact Collection und Local-Service-Legacy |
| `apps/api/src/chat/flow-builder.ts` | Generische Conversation-Flow-Signale fuer Contact Intent, qualifizierten Bedarf, Kontext und Dringlichkeit |
| `apps/api/src/chat/conversation-guide.ts` | Prompt-/Guide-State fuer generische Konversation; keine direkte Persistenz |
| `apps/api/src/ai/chat-pipeline/conversation-state.service.ts` | Conversation/Message/Widget-Session-Persistenz ausserhalb des Orchestrators |
| `apps/api/src/ai/chat-pipeline/response-composer.service.ts` | Baut generische und Local-Service Conversation Guides; muss Public Response Shape unveraendert lassen |
| `apps/api/src/modules/widget/services/widget-chat.service.ts` | Public Widget Entry; prueft Site/Origin/Session, beobachtet AssistantProfile read-only, gibt Legacy Response Shape zurueck |
| `apps/api/src/assistant-profiles/assistant-profile-resolver.service.ts` | Normalisiert Config in AssistantProfile, aber Live-Orchestrator nutzt es noch nicht als Entscheidungsquelle |
| `apps/api/test/chat-agent-orchestrator.service.test.cjs` | Hauptabdeckung fuer Contact Collection, Lead Capture, Schedule Handoff, IT-Abgrenzung, Local-Service-Kompatibilitaet |
| `apps/api/test/widget-chat-flow.test.cjs` | Public Widget Response Shape, AssistantProfile Observability und generische/Local-Service Guide-Abgrenzung |
| `apps/api/test/local-service-legacy-helpers.test.cjs` | Pure Helper Regression fuer Local-Service, relevant als Grenze fuer P1.2B-3 |

## Contact Collection Responsibilities

| Methode/Funktion | Datei | Verantwortung | liest Metadata | schreibt Metadata | erzeugt Side Effects | Antworttext | Extraktionsrisiko |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `decide` | `chat-agent-orchestrator.service.ts` | Orchestriert Lead Intent, Schedule Intent, Contact Extraction, Missing Fields, Pending Lead, Capture und Handoff | Ja | Ja | Ja | Ja | Sehr hoch |
| `loadConversationMetadata` | `chat-agent-orchestrator.service.ts` | Laedt `pendingLead`, `pendingTicket`, `conversationState` aus `conversations.metadata` | Ja | Nein | DB read | Nein | Mittel |
| `parsePendingLeadState` | `chat-agent-orchestrator.service.ts` | Normalisiert gespeicherten Pending-Lead-State | Ja | Nein | Nein | Nein | Mittel |
| `parseConversationState` | `chat-agent-orchestrator.service.ts` | Normalisiert generischen Conversation-State mit `collectedFields`, `missingFields`, `nextExpectedField` | Ja | Nein | Nein | Nein | Mittel |
| `extractContactDetails` | `chat-agent-orchestrator.service.ts` | Extrahiert Name, E-Mail, Telefon, Anliegen, Ort, Dringlichkeit und bevorzugten Kontaktkanal aus einer Nachricht | Pending Lead | Nein | Nein | Nein | Hoch |
| `extractPhoneNumber` | `chat-agent-orchestrator.service.ts` | Extrahiert und validiert Telefonnummer | Nein | Nein | Nein | Nein | Mittel |
| `extractName` | `chat-agent-orchestrator.service.ts` | Extrahiert explizite Namensformulierungen | Nein | Nein | Nein | Nein | Mittel |
| `inferNameFromPendingAnswer` | `chat-agent-orchestrator.service.ts` | Interpretiert freie Antwort als Namen, wenn ein Pending Lead aktiv ist | Pending Lead | Nein | Nein | Nein | Hoch |
| `extractConcern` | `chat-agent-orchestrator.service.ts` | Extrahiert Anliegen und vermeidet Kontakt-only, generische Termin- oder Local-Service-Only-Signale | Pending Lead | Nein | Nein | Nein | Hoch |
| `sanitizeConcern` | `chat-agent-orchestrator.service.ts` | Entfernt E-Mail, Telefon und Namensphrasen aus Anliegen | Nein | Nein | Nein | Nein | Mittel |
| `extractPreferredContact` | `chat-agent-orchestrator.service.ts` | Erkennt E-Mail- oder Telefonpraeferenz | Nein | Nein | Nein | Nein | Niedrig |
| `mergeContactDetails` | `chat-agent-orchestrator.service.ts` | Fuehrt neue Contact-Felder mit `pendingLead` zusammen | Pending Lead | Nein | Nein | Nein | Mittel |
| `mergeContactDetailsFromState` | `chat-agent-orchestrator.service.ts` | Fuehrt neue Contact-Felder mit `conversationState.collectedFields` und Topic zusammen | Conversation State | Nein | Nein | Nein | Mittel |
| `ensureScheduleContactContext` | `chat-agent-orchestrator.service.ts` | Nutzt vorhandenen Topic-Kontext als Anliegen fuer Terminpfade | Conversation State | Nein | Nein | Nein | Mittel |
| `buildConversationState` | `chat-agent-orchestrator.service.ts` | Baut generischen `conversationState` mit Intent, Stage, Topic, Goal, collected/missing Fields | Conversation State | Nein | Nein | Nein | Hoch |
| `inferConversationIntent` | `chat-agent-orchestrator.service.ts` | Erkennt appointment/support/ticket/product/lead fuer generischen State | Nein | Nein | Nein | Nein | Mittel |
| `inferTopic` | `chat-agent-orchestrator.service.ts` | Ermittelt Thema/Anliegen aus Nachricht, Kontakt und altem State | Conversation State | Nein | Nein | Nein | Hoch |
| `inferUrgency` | `chat-agent-orchestrator.service.ts` | Leitet generische Dringlichkeit ab | Nein | Nein | Nein | Nein | Niedrig |
| `buildPendingLeadState` | `chat-agent-orchestrator.service.ts` | Erstellt/aktualisiert Pending Lead inklusive Prompt Count und Schedule Intent | Pending Lead | Nein | Nein | Nein | Mittel |
| `buildPausedLeadState` | `chat-agent-orchestrator.service.ts` | Pausiert Kontaktaufnahme bei Refusal, Recovery, Greeting, Prompt Limit oder weak quality | Pending Lead | Nein | Nein | Nein | Mittel |
| `getMissingContactFields` | `chat-agent-orchestrator.service.ts` | Ermittelt generische Pflichtfelder `concern`, `name`, `contact`; delegiert Local-Service an Helper | Nein | Nein | Nein | Nein | Hoch |
| `canAskForLeadDetails` | `chat-agent-orchestrator.service.ts` | Entscheidet, ob nach Kontaktfeldern gefragt werden darf | Pending Lead indirekt | Nein | Nein | Nein | Hoch |
| `hasLeadProgressSignal` | `chat-agent-orchestrator.service.ts` | Erkennt Fortschritt waehrend Pending Lead | Nein | Nein | Nein | Nein | Mittel |
| `hasLeadCaptureQuality` | `chat-agent-orchestrator.service.ts` | Gate vor echter Lead-Erzeugung | Nein | Nein | Nein | Nein | Hoch |
| `shouldQualifyBeforeContact` | `chat-agent-orchestrator.service.ts` | Verhindert zu fruehe Kontaktfrage bei breitem KI-/Business-Bedarf | Nein | Nein | Nein | Nein | Hoch |
| `buildMissingFieldsQuestion` | `chat-agent-orchestrator.service.ts` | Baut bestehende Rueckfragen fuer generische Missing Fields und delegiert Local-Service-Fragen | Nein | Nein | Nein | Ja | Hoch |
| `buildCapturedLeadAnswer` | `chat-agent-orchestrator.service.ts` | Baut Abschlussantwort nach Lead/Schedule Capture | Nein | Nein | Nein | Ja | Mittel |
| `buildBusinessNeedQualificationAnswer` | `chat-agent-orchestrator.service.ts` | Qualifizierungsantwort vor Kontaktfrage | Nein | Nein | Nein | Ja | Mittel |
| `buildConsultingResetAnswer` | `chat-agent-orchestrator.service.ts` | Antwort bei pausierter oder zu schwacher Lead-Qualitaet | Nein | Nein | Nein | Ja | Mittel |
| `saveConversationMetadata` | `chat-agent-orchestrator.service.ts` | Patcht `pendingLead`, `pendingTicket`, `conversationState` in JSONB | Ja | Ja | DB write | Nein | Hoch, zunaechst nicht extrahieren |
| `recordLeadAudit` | `chat-agent-orchestrator.service.ts` | Audit fuer Pending/Lead/Schedule ohne PII-Inhalte | Nein | Nein | `audit_logs` | Nein | Mittel, zunaechst nicht extrahieren |
| `captureLead` | `chat-agent-orchestrator.service.ts` | Dedup, Plan-Limit, `widget_leads` Insert, `widget_sessions.lead_captured` | Nein | Nein | `widget_leads`, `widget_sessions`, usage limit | Nein | Sehr hoch, nicht in ContactCollectionFlowService |
| `createContactRequest` | `chat-agent-orchestrator.service.ts` | Erstellt `agent_contact_requests` fuer Termin-/Kontakt-Handoff | Nein | Nein | `agent_contact_requests` | Nein | Hoch, nicht in ContactCollectionFlowService |
| `queueInternalLeadNotification` | `chat-agent-orchestrator.service.ts` | Queued `email_jobs` fuer Lead Notification | Nein | Nein | `email_jobs`, Logs | Nein | Hoch, nicht in ContactCollectionFlowService |
| `handleItSupportFlow` / `collectItSupportTicketFields` | `chat-agent-orchestrator.service.ts` | Separater IT-Ticket-Pflichtfeldflow | Pending Ticket | Ja | Tool/Ticket moeglich | Ja | Separat halten, nicht mit ContactCollection vermischen |
| `ConversationStateService.ensureConversation/appendMessage/touchWidgetSession` | `conversation-state.service.ts` | Persistiert Conversation, Messages und Widget Session | Nein | Nein | DB writes | Nein | Ausserhalb von P1.2B-3 |
| `WidgetChatService.sendMessage/streamMessage` | `widget-chat.service.ts` | Public Widget Entry und Response Shape | Nein | Nein | Pipeline-Aufruf, keine eigenen Lead-Side-Effects | Nein | Niedrig, nicht aendern |
| `AssistantProfileResolverService.resolve` | `assistant-profile-resolver.service.ts` | Liefert requiredFields/deliveryChannels read-only; Live-Contact-Flow nutzt es noch nicht direkt | Nein | Nein | Nein | Nein | Mittel fuer spaetere Integration |

## Current Generic Contact Flow Map

1. `WidgetChatService` validiert Site, Origin und Session und ruft `ChatPipelineService`.
2. `ChatPipelineService` erzeugt/aktualisiert Conversation und Message und ruft `ChatAgentOrchestratorService.decide`.
3. `decide` laedt Module/Site Config, `pendingLead`, `pendingTicket` und `conversationState`.
4. `extractContactDetails` extrahiert Contact-Felder aus der aktuellen User-Nachricht.
5. `buildConversationState` aktualisiert semantischen State und `collectedFields`.
6. Early Returns schuetzen sensitive Daten, IT-Support, Local-Service-Stop/Pricing, Greetings, Recovery und deaktiviertes Lead Feature.
7. Wenn Lead-/Schedule-/Contact-Kontext aktiv ist, wird `contact` aus Nachricht, Pending Lead und Conversation State zusammengefuehrt.
8. `getMissingContactFields` bestimmt generisch: erst `concern`, dann `name`, dann `contact` als E-Mail oder Telefon.
9. `canAskForLeadDetails` verhindert zu aggressive Kontaktfragen, insbesondere bei Recovery/Refusal/Greeting, Prompt-Limit und schwachem Intent.
10. Bei fehlenden Feldern speichert der Orchestrator `pendingLead` und `conversationState`, schreibt Audit und antwortet mit `buildMissingFieldsQuestion`.
11. Bei vollstaendigen Daten prueft `hasLeadCaptureQuality`.
12. Erst danach erzeugt `captureLead` echte Leads und `queueInternalLeadNotification` optional Mail-Jobs.
13. Bei Schedule-Kontext erzeugt `createContactRequest` optional einen Handoff-Datensatz.

## Existing Test Coverage

| Bereich | Bestehende Tests |
| --- | --- |
| Kein Lead bei normalem Chat/Greeting/Sensitivdaten | `lets normal chat continue untouched`, `answers greetings`, `rejects sensitive credentials` |
| Generischer Lead-Start | `starts a pending lead and asks for the concern first` |
| Mehrnachrichten-Lead-Capture | `captures a lead over multiple messages` |
| Universal bleibt nicht Local-Service | `keeps universal required fields out of local service intake` |
| Recovery/Refusal/Prompt-Limit | `pauses pending lead on confusion`, `does not repeat contact question after refusal`, `stops lead prompt after one unanswered contact request` |
| Qualifizierung vor Kontakt | `qualifies broad AI need before asking for contact` |
| Angebot/Lead Intent | `allows offer intent to enter lead flow` |
| Pending Lead mit E-Mail | `captures when user provides email in pending lead flow` |
| Schedule/Handoff | `marks schedule intent and prepares contact handoff`, `returns schedule link`, `asks for contact when appointment has context but no schedule link` |
| Preferred Contact | `turns preferred phone channel into a concrete phone request` |
| Dedupe und SMTP-Fallback | `deduplicates repeated lead data`, `stores lead when SMTP is missing` |
| Plan Limit | `returns a plan limit message without storing lead` |
| IT-Ticket-Abgrenzung | Mehrere IT-Support-Tests stellen sicher, dass `pendingLead` bei Ticketpfaden null bleibt |
| Public Widget Shape | `widget-chat-flow` prueft Legacy Response und keine Debug-Ausgabe |

## Proposed ContactCollectionFlowService Boundary

### Sollte enthalten

- `extractContactDetails`
- `extractPhoneNumber`
- `extractName`
- `inferNameFromPendingAnswer`
- `extractConcern`
- `sanitizeConcern`
- `extractPreferredContact`
- `mergeContactDetails`
- `mergeContactDetailsFromState`
- `ensureScheduleContactContext`
- `buildConversationState`
- `buildPendingLeadState`
- `buildPausedLeadState`
- `getMissingContactFields`
- `canAskForLeadDetails`
- `hasLeadProgressSignal`
- `hasLeadCaptureQuality`
- `shouldQualifyBeforeContact`
- generische Missing-Field-Antwortauswahl, solange Text byte-identisch bleibt

### Sollte nicht enthalten

- `captureLead`
- `createContactRequest`
- `queueInternalLeadNotification`
- `recordLeadAudit`
- `saveConversationMetadata`
- `loadConversationMetadata`
- IT-Ticket-State-Machine
- Local-Service-spezifische Persistenz oder Side Effects
- Public Widget Controller/Response Shape
- LLM/RAG/Response Composer

### Empfohlene API

```ts
type ContactCollectionInput = {
  message: string;
  history: ChatHistoryEntry[];
  pendingLead: PendingLeadState | null;
  conversationState: ConversationState | null;
  contactFromMessage: ContactDetails;
  leadIntent: boolean;
  scheduleIntent: boolean;
  askedForContact: boolean;
  localServiceFlow: boolean;
  intakeFlow?: LocalServiceIntakeFlowConfig;
};

type ContactCollectionDecision = {
  status:
    | 'not_applicable'
    | 'qualification_needed'
    | 'ask_missing_fields'
    | 'pause'
    | 'capture_ready';
  contact: ContactDetails;
  missingFields: string[];
  pendingLeadPatch?: PendingLeadState | null;
  conversationStatePatch?: ConversationState;
  auditAction?: 'lead_pending_started' | 'lead_pending_updated' | 'schedule_intent_detected';
  auditMetadata?: Record<string, unknown>;
  answer?: string;
};
```

Die Antworttexte koennen in Phase 1 noch direkt als bestehende Strings zurueckgegeben werden. Spaeter kann daraus eine `ConversationResponsePolicyService`-Grenze entstehen.

## Risk Areas

- `decide` hat viele Early Returns; eine falsche Reihenfolge kann Public-Widget-Verhalten aendern.
- Contact Collection teilt sich `ContactDetails` mit Local-Service-Feldern `location` und `urgency`.
- Generische `getMissingContactFields` und Local-Service Missing Fields nutzen dieselbe Funktion mit `localServiceFlow`-Switch.
- `buildConversationState` berechnet Missing Fields generisch, waehrend der spaetere Lead-Pfad Missing Fields ggf. local-service-spezifisch berechnet.
- `pendingLead.leadPromptCount` steuert Prompt-Limit und darf bei Extraktion nicht doppelt oder zu spaet inkrementiert werden.
- `shouldQualifyBeforeContact` verhindert aggressive Kontaktfragen und ist UX-/Conversion-kritisch.
- Schedule-Flow erzeugt sowohl Lead als auch optional `agent_contact_requests`.
- `hasLeadCaptureQuality` ist das letzte Gate vor echten Side Effects.
- Audit-Metadata darf keine PII enthalten; bestehende Tests pruefen, dass das Anliegen nicht in Audit-Metadata landet.
- Antworttexte sind test- und produktionskritisch; Textaenderungen sind nicht Teil der Extraktion.
- IT-Ticket-Pfade setzen `pendingLead: null`; ContactCollection darf diese Grenze nicht ueberschreiben.
- AssistantProfile `requiredFields` ist vorbereitet, aber Live-Contact-Flow nutzt es noch nicht als Source of Truth.

## Recommended Extraction Phases

### Phase 1: Pure Helper Extraction

- Neue Datei z. B. `apps/api/src/chat/contact-collection-flow.service.ts` oder zuerst `contact-collection.helpers.ts`.
- Nur reine Funktionen verschieben: Extraction, Merge, Missing Fields, State Builders, Lead Quality, Ask/Pause Entscheidung.
- Orchestrator ruft dieselben Funktionen an derselben Stelle.
- Keine Injectable-Abhaengigkeiten.
- Keine DB, Mail, Audit, ToolExecutor, UsageLimit.

### Phase 2: Decision Service ohne Side Effects

- `ContactCollectionFlowService.evaluate(input)` erzeugt eine `ContactCollectionDecision`.
- Orchestrator bleibt fuer `saveConversationMetadata`, `recordLeadAudit`, `captureLead`, `createContactRequest`, `queueInternalLeadNotification` verantwortlich.
- Antworttexte bleiben byte-identisch oder werden ueber bestehende Builder weitergereicht.

### Phase 3: Persistence Boundary

- Optional separater `LeadCaptureFlowService` fuer `captureLead`, Audit und Notification.
- Erst nach stabiler Decision-Service-Abdeckung.
- Idempotenz, Plan-Limit und Mail-Fallback separat testen.

### Phase 4: AssistantProfile Integration

- Erst wenn Source-of-Truth fuer `assistant-profile` stabil ist.
- `AssistantProfile.requiredFields` kann generische Missing Fields ergaenzen.
- Public Widget bleibt Legacy, bis explizite Feature-Flag-/Rollout-Freigabe erfolgt.

## Required Tests Before Any Extraction Commit

- Golden/behavior tests fuer bestehende generische Antworttexte:
  - `Ich brauche Beratung` -> fragt nach Anliegen.
  - Anliegen danach -> fragt nach Name.
  - Name danach -> fragt nach E-Mail oder Telefon.
  - E-Mail danach -> `capture_lead`.
- State tests:
  - `pendingLead.status`, `leadPromptCount`, `scheduleIntent`, `conversationState.stage`, `goal`, `nextExpectedField`.
- Pause tests:
  - Recovery, Refusal, Greeting, Prompt Limit.
- Schedule tests:
  - Termin mit bestehendem Topic.
  - Preferred phone channel.
  - Schedule URL erzeugt `suggest_schedule`.
- Side-effect tests:
  - Keine Leads vor `capture_ready`.
  - Keine `email_jobs` vor Lead-Capture.
  - Keine `agent_contact_requests` ohne Schedule/Contact completion.
- Boundary tests:
  - IT-Ticket setzt `pendingLead` null und wird nicht von ContactCollection uebernommen.
  - Local-Service bleibt auf Local-Service-Helfern.
  - Universal required fields erzeugen keine Einsatzadresse-/Dringlichkeits-Sprache.
- Public Widget tests:
  - Response Shape unveraendert.
  - Keine Debug-/Preview-Felder.
- Safety tests:
  - Sensitive Input erzeugt keine ContactCollection-Persistenz.
  - Audit-Metadata bleibt ohne PII.

## Non-goals

- Keine Live-Schaltung der Conversation Engine.
- Keine AssistantProfile-Migration.
- Keine Aenderung von Public Widget Response Shape.
- Keine Antworttext-Anpassung.
- Keine neue Lead-/Ticket-/Job-Logik.
- Keine Datenbankmigration.
- Keine Feature Flags.

## Recommended Next Step

P1.2B-3B sollte nur Phase 1 umsetzen: reine Contact-Collection-Helfer extrahieren und vom Orchestrator an exakt denselben Stellen verwenden. Der Commit sollte keine `PrismaService`-, Mail-, Tool-, Audit- oder Queue-Abhaengigkeit im neuen Helper enthalten. Bestehende Tests plus neue Pure-Helper-Tests muessen gruen bleiben.
