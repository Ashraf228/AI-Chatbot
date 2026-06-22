# Evaluation Workspace Security Model

Diese Dokumentation beschreibt den technischen Kooperationsdemonstrator. Sie ist keine Rechtsberatung und beschreibt keine produktive Integration.

## Zweck

Der Evaluation Workspace stellt externen Kooperationspartnern einen strikt begrenzten Testbereich bereit. Viewer koennen synthetische Szenarien testen, erhalten aber keinen Zugriff auf bestehende Admin-, Customer-, Knowledge-, Ticket-, Lead-, Billing- oder Integrationsdaten.

## Datenmodell

- `tenant_users.evaluation_site_id` bindet einen Viewer serverseitig an genau eine Site.
- `sites.is_evaluation_demo` markiert Sites, die als Demonstrator freigegeben sind.
- `evaluation_chat_sessions` bindet einen Evaluationsdialog an `tenant_user_id`, `tenant_id`, `site_id` und eine interne Conversation-Session.
- Bestehende Sites bleiben standardmaessig `is_evaluation_demo=false`.
- Bestehende Benutzer erhalten keine automatische Evaluation-Site.

## Serverseitige Bindung und Revalidierung

Jeder Zugriff auf `/evaluation`, `/api/auth/session` fuer Viewer und `/api/evaluation/*` wird serverseitig neu validiert:

- Tenant-User existiert.
- Tenant-User ist aktiv.
- Rolle ist weiterhin `viewer`.
- `expires_at` ist nicht abgelaufen.
- `evaluation_site_id` ist gesetzt.
- Die zugewiesene Site gehoert zum selben Tenant.
- Die Site ist als Evaluation-Demo markiert.
- Die Site ist nicht deaktiviert.

Es gibt keine positive Langzeit-Cacheentscheidung. `Cache-Control: no-store` wird fuer Evaluation-Responses gesetzt.

## Viewer-Allowlist

Erlaubt sind nur:

- Login
- Logout
- `GET /api/auth/session`
- `GET /evaluation`
- `GET /api/evaluation/context`
- `POST /api/evaluation/chat/session`
- `POST /api/evaluation/chat/message`

Alle bestehenden Admin-, Customer- und Dashboard-API-Routen bleiben fuer Viewer gesperrt.

## Dedizierte Endpunkte

Die Browseroberflaeche nutzt ausschliesslich `/api/evaluation/*`. Diese Dashboard-Routen leiten serverseitig mit `DASHBOARD_INTERNAL_TOKEN` an die isolierten Backend-Endpunkte unter `/admin/evaluation/*` weiter. Browserwerte fuer Tenant, Site, Rolle, Modell, Agent, Systemprompt, Tools oder Knowledge-Dokumente werden nicht akzeptiert.

## Rueckgabeprojektionen

`GET /api/evaluation/context` liefert nur:

- Workspace- und Site-Titel
- Demo-/Read-only-Hinweise
- Ablaufdaten
- Szenarien
- technische Feature-Liste

Nicht ausgegeben werden Tenant-ID, Site-ID, Tenant-User-ID, Tokens, Secrets, Systemprompts, Modellkonfiguration, Integrationen, Webhook-URLs, Embed-Code oder interne Datenbank-IDs.

Chatantworten enthalten nur:

- `conversationId`
- `messageId`
- `answer`
- `answerStatus`
- sanitierte Quellenprojektion
- optionale Handoff-Vorschau
- `completedAt`

Quellen enthalten keine Embeddings, Scores, Chunk-IDs, interne Dokument-IDs, Dateipfade, privaten URLs oder Raw Metadata. Unsichere URLs werden nicht als Link ausgegeben.

## Chat-Ownership

Eine Evaluation-Conversation-ID allein reicht nicht als Berechtigung. Jede Chat-Nachricht prueft:

- aktueller Viewer,
- gebundene Demo-Site,
- Tenant,
- gespeicherte Evaluation-Session,
- Ablauf der Evaluation-Session.

Conversation-Daten anderer Viewer, anderer Tenants oder anderer Sites werden abgewiesen.

## Rate Limits

Evaluation-Chatnachrichten werden pro Tenant-User begrenzt. Die bestehende Infrastruktur fuer Rate Limits wird genutzt. Rate-Limit-Fehler geben keine internen Details aus.

## Auditierung ohne Chatinhalt

Erfasst werden technische Events wie:

- `evaluation_workspace_opened`
- `evaluation_chat_session_created`
- `evaluation_message_submitted`

Audit-Metadata darf keine Chattexte, Antworttexte, Tokens, Passwoerter, vollstaendige Quelleninhalte oder Handoff-Freitexte enthalten.

## Deaktivierung und Ablauf

Deaktivierung, Rollenwechsel, abgelaufenes `expires_at`, entfernte `evaluation_site_id` oder entfernte Demo-Markierung werden beim naechsten geschuetzten Request wirksam. Bereits ausgestellte stateless Sessiontokens reichen ohne erfolgreiche Evaluation-Revalidierung nicht aus.

## Bekannte Einschraenkungen

- Der Workspace ist weiterhin ein Demonstrator.
- Es gibt keine produktive NOLIS-Integration.
- Synthetische Demo-Inhalte werden separat provisioniert.
- Kein externer Handoff wird in diesem Schritt ausgefuehrt.
