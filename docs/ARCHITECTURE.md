# Architecture

## High-Level

```text
Customer Website
  -> Widget Loader / Widget App
  -> Public Widget API
  -> Chat Pipeline
  -> Routing + Knowledge/RAG + Agent Orchestrator
  -> Tool Executor
  -> Leads / Tickets / Integrations / Audit / Usage

Internal Operator
  -> Dashboard
  -> Dashboard API Proxies
  -> Admin API
  -> Sites / Knowledge / Integrations / Analytics / Privacy / Billing
```

## Apps

- `apps/api`: Backend und zentrale Business-Logik.
- `apps/dashboard`: internes Dashboard fuer Einrichtung, Betrieb und Auswertung.
- `apps/widget`: Chat-Widget fuer Kundenseiten.
- `apps/reporter`: optionale Reportjobs.

## Widget Chat Flow

```text
loader.js
  -> GET /widget/config?siteKey=...
  -> POST /widget/session
  -> POST /widget/chat
  -> ChatPipelineService
  -> Response
```

Public Widget Routes nutzen `siteKey`, Origin Validation, allowed domains und Rate Limits. Sie verwenden keine Dashboard-Session.

## Chat Pipeline

```text
ChatService / WidgetChatService
  -> ChatPipelineService
  -> ConversationStateService
  -> ChatRoutingService
  -> Vector/RAG Retrieval
  -> ChatAgentOrchestratorService
  -> ToolExecutorService
  -> ResponseComposerService
```

Die Pipeline normalisiert Input, verwaltet Conversation State, persistiert Messages, zaehlt Usage und gibt kompatible JSON-/Streaming-Antworten zurueck.

## Orchestration

Der Orchestrator erzeugt strukturierte Decisions:

- `answer`
- `ask_followup`
- `capture_lead`
- `schedule_contact`
- `create_ticket`
- `recommend_service`
- `handoff`
- `trigger_tool`

Memory basiert aktuell auf `conversations.metadata` und vorhandenen Messages.

## Tool Execution

Tools werden zentral validiert, ausgefuehrt und in `tool_invocations` protokolliert:

- `capture_lead`
- `schedule_contact`
- `create_ticket`
- `push_webhook`
- `query_knowledge`
- `recommend_service`
- `handoff`

Tool-Fehler sollen den Chat nicht hart abbrechen.

## Knowledge/RAG

Knowledge Sources sind site-/tenant-scoped und koennen aktiv, disabled, ready, processing oder failed sein. Retrieval nutzt nur aktive und ready Sources. `knowledgeMode` steuert, ob Antworten flexibel, grounded oder strict sind.

## Integrationen

Integrationen sind pro Site konfigurierbar und werden ueber den Integration Event Dispatcher angesprochen. Secrets werden maskiert/verschluesselt und nicht in Responses oder Logs ausgegeben.

## Dashboard

Dashboard-Routen laufen ueber Next.js API-Proxies. Diese senden Session-Kontext an das Backend:

- Rolle
- Actor
- Tenant
- Dashboard Internal Token

Das Backend bleibt die fachliche Quelle fuer Status, Templates, Limits und Zugriff.

## Security And Privacy

- `AdminScopeService` prueft Tenant-/Site-Zugriff.
- Public Widget APIs sind getrennt von Admin APIs.
- Rate Limits schuetzen Login, Widget und teure Admin-Aktionen.
- Privacy Export/Delete ist site-scoped.
- PII/Secrets werden fuer technische Logs reduziert/maskiert.

## Billing And Usage

Plans und Subscriptions liegen in `plans` und `tenant_subscriptions`. Usage wird aus bestehenden operativen Tabellen aggregiert:

- `usage_daily`
- `conversations`
- `widget_leads`
- `tool_invocations`
- `knowledge_sources`
- `integration_connections`
- `sites`

Limits werden an Creation-/Chat-Pfaden geprueft.

## Deployment Topologie

```text
Internet
  -> proxy :80/:443
     -> dashboard:3000
     -> api:5000
     -> widget:80

internal network:
  -> postgres/pgvector
  -> redis
```

Postgres und Redis sollen nie direkt oeffentlich exposed werden.
