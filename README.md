# AI-Chatbot

Multi-tenant KI-Chatbot- und Agentenplattform fuer B2B-Kunden. Das System stellt pro Kunde ein Website-Widget bereit, verwaltet Wissen/RAG, Agenten-Aktionen, Leads, Integrationen, Reports, DSGVO-Funktionen und interne Business-KPIs.

## Architektur

- `apps/api`: NestJS Backend, Chat-Pipeline, Orchestrator, Tools, Knowledge/RAG, Integrationen, Billing/Usage, Privacy.
- `apps/dashboard`: Next.js Dashboard fuer interne Mitarbeiter und Betreiber.
- `apps/widget`: embeddbares Chat-Widget und Loader.
- `apps/reporter`: optionale Report- und Mail-Jobs.
- `infra/nginx`: Docker Reverse Proxy fuer Dashboard, API und Widget.

Weitere Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Quickstart

```bash
npm install
cp .env.example .env
npm run docker:up
```

Danach lokal mit Hostnamen testen:

```text
127.0.0.1 admin.localhost
127.0.0.1 api.localhost
127.0.0.1 widget.localhost
```

- Dashboard: `http://admin.localhost`
- API Health: `http://api.localhost/healthz`
- Widget Loader: `http://widget.localhost/loader.js`

## Wichtige Scripts

```bash
npm run check:api
npm run build:api
npm run test:smoke
npm run check:dashboard
npm run check:all
npm run build:all
npm run db:migrate
npm run docker:config
npm run docker:up
npm run docker:down
```

## Deployment Und Betrieb

- Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Migrationen: [docs/MIGRATIONS.md](docs/MIGRATIONS.md)
- Backups: [docs/BACKUP_AND_RESTORE.md](docs/BACKUP_AND_RESTORE.md)
- Production Checklist: [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md)
- Security: [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md)
- DSGVO/Privacy: [docs/DSGVO_PRIVACY.md](docs/DSGVO_PRIVACY.md)
- Release Notes: [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md)

## Production-Hinweis

Vor echter Kundenproduktion muessen produktive Secrets gesetzt, HTTPS aktiviert, Backups getestet, Smoke-Tests ausgefuehrt und mindestens ein kompletter Widget-End-to-End-Test auf einer echten Kundendomain durchgefuehrt werden.
