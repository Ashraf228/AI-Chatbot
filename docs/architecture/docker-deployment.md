# Docker Deployment

Dieses Projekt ist als Monorepo aufgebaut und verwendet Docker Compose fuer die Kernservices:

- `api` fuer das NestJS-Backend
- `widget` fuer `loader.js`, `widget.js` und die proxyte Public-Widget-API
- `dashboard` fuer das Next.js Admin Panel
- `db` fuer PostgreSQL mit pgvector
- `redis` fuer Rate Limiting und Cache
- `reporter` optional fuer Reporting-Jobs

## Voraussetzungen

- Docker
- Docker Compose
- eine `.env` Datei im Projektroot auf Basis von [.env.example](/Users/ash/Documents/New%20project/AI-Chatbot/.env.example)

## Wichtige Umgebungsvariablen

Mindestens diese Werte sollten gesetzt sein:

```env
OPENAI_API_KEY=...
ADMIN_KEY=...
ADMIN_PANEL_PASSWORD=...
ADMIN_SESSION_SECRET=...
DATABASE_URL=postgres://postgres:postgres@db:5432/chatbot
REDIS_URL=redis://redis:6379
BACKEND_BASE_URL=http://localhost:5001
PUBLIC_API_BASE_URL=http://localhost:8080
PUBLIC_WIDGET_BUNDLE_URL=http://localhost:8080/widget.js
NEXT_PUBLIC_WIDGET_LOADER_URL=http://localhost:8080/loader.js
SITE_DOMAIN_ALLOWLIST_MODE=strict
```

## Lokaler Start

API, Dashboard, Widget, Datenbank und Redis starten:

```bash
docker compose up --build
```

Danach sind die Dienste erreichbar unter:

- Dashboard: `http://localhost:3000`
- API: `http://localhost:5001`
- Widget Loader: `http://localhost:8080/loader.js`
- Widget Bundle: `http://localhost:8080/widget.js`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Reporter mitstarten

Den optionalen Reporter-Container mit Profil aktivieren:

```bash
docker compose --profile reporter up --build
```

Optional kann der Jobtyp ueber `.env` gesteuert werden:

```env
REPORTER_JOB=weekly
```

Moegliche Werte:

- `weekly`
- `monthly`
- `lead-digest`

## Empfohlene Startreihenfolge fuer einen Server

1. `.env` mit produktiven Secrets anlegen
2. `BACKEND_BASE_URL`, `PUBLIC_API_BASE_URL`, `PUBLIC_WIDGET_BUNDLE_URL` und `NEXT_PUBLIC_WIDGET_LOADER_URL` auf echte Domains setzen
3. `docker compose up --build -d`
4. optional Reporter mit Profil starten
5. `siteKey`, Branding und erlaubte Domains im Admin-Setup pflegen
6. Loader-Script auf Kundenseiten einbinden

## Hinweise

- Der Widget-Host liefert `loader.js` und `widget.js` gemeinsam aus und proxyt `/widget/*` intern zur API. Dadurch reicht spaeter ein einziges Script-Snippet fuer Kunden.
- Das Backend legt benoetigte Tabellen beim Start selbst an.
- Fuer produktive Umgebungen sollte vor dem Go-Live ein echter End-to-End-Compose-Test durchgefuehrt werden.
- Fuer den Internetbetrieb solltest du Reverse Proxy, TLS und Secret-Management sauber davor setzen.
