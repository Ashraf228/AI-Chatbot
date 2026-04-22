# Docker Deployment

Dieses Projekt ist als Monorepo aufgebaut und verwendet Docker Compose fuer die Kernservices:

- `proxy` als einziger oeffentlicher Nginx Reverse Proxy
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
ADMIN_PANEL_PASSWORD_HASH=scrypt$<saltHex>$<hashHex>
ADMIN_SESSION_SECRET=...
POSTGRES_PASSWORD=...
REDIS_PASSWORD=...
BACKEND_BASE_URL=http://api:5000
REPORTER_API_BASE_URL=http://api:5000
PUBLIC_API_BASE_URL=https://api.example.com
PUBLIC_WIDGET_BUNDLE_URL=https://widget.example.com/widget.js
NEXT_PUBLIC_WIDGET_LOADER_URL=https://widget.example.com/loader.js
ADMIN_DOMAIN=admin.example.com
API_DOMAIN=api.example.com
WIDGET_DOMAIN=widget.example.com
CORS_ALLOWED_ORIGINS=https://admin.example.com
TLS_ENABLED=true
TLS_CERTS_DIR=/etc/letsencrypt/live/your-domain
TLS_CERT_PATH=/etc/nginx/certs/fullchain.pem
TLS_KEY_PATH=/etc/nginx/certs/privkey.pem
SITE_DOMAIN_ALLOWLIST_MODE=strict
```

Fuer die Generierung sicherer lokaler Werte gibt es jetzt ein Hilfsscript:

```bash
npm run generate:server-secrets
```

Das Script erzeugt:

- `ADMIN_KEY`
- `ADMIN_SESSION_SECRET`
- ein zufaelliges `ADMIN_PANEL_PASSWORD`
- das passende `ADMIN_PANEL_PASSWORD_HASH` im Format `scrypt$<saltHex>$<hashHex>`

Fuer Produktion solltest du nur den Hash in die Server-`.env` uebernehmen und das Klartext-Passwort danach sicher separat verwahren.

## Lokaler Start

Proxy, API, Dashboard, Widget, Datenbank und Redis starten:

```bash
docker compose up --build
```

Danach sind die Dienste erreichbar unter:

- Reverse Proxy: `http://localhost`
- intern: `dashboard`, `api`, `widget`, `db`, `redis` sind nur im Docker-Netz erreichbar

Fuer einen lokalen Test mit Hostnamen kannst du Eintraege wie diese in `/etc/hosts` setzen:

```text
127.0.0.1 admin.localhost
127.0.0.1 api.localhost
127.0.0.1 widget.localhost
```

Dann erreichst du:

- Dashboard: `http://admin.localhost`
- API: `http://api.localhost`
- Widget Loader: `http://widget.localhost/loader.js`
- Widget Bundle: `http://widget.localhost/widget.js`

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
2. `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `BACKEND_BASE_URL`, `PUBLIC_API_BASE_URL`, `PUBLIC_WIDGET_BUNDLE_URL`, `NEXT_PUBLIC_WIDGET_LOADER_URL`, `ADMIN_DOMAIN`, `API_DOMAIN` und `WIDGET_DOMAIN` auf produktive Werte setzen
3. `docker compose up --build -d`
4. optional Reporter mit Profil starten
5. `siteKey`, Branding und erlaubte Domains im Admin-Setup pflegen
6. Loader-Script auf Kundenseiten einbinden

## Hinweise

- Nur der Nginx-Proxy ist nach aussen exponiert. API, Dashboard, Widget, PostgreSQL und Redis bleiben intern im Docker-Netz.
- Redis laeuft mit Passwortschutz und ist nicht mehr ueber einen Host-Port erreichbar.
- Das Dashboard verwendet fuer Login-Rate-Limits Redis statt eines rein lokalen In-Memory-Counters.
- Der Widget-Host liefert `loader.js` und `widget.js` gemeinsam aus und proxyt `/widget/*` intern zur API. Dadurch reicht spaeter ein einziges Script-Snippet fuer Kunden.
- Das Backend legt benoetigte Tabellen beim Start selbst an.
- Fuer produktive Umgebungen sollte vor dem Go-Live ein echter End-to-End-Compose-Test durchgefuehrt werden.
- Wenn `TLS_ENABLED=true` gesetzt ist, lauscht der interne Nginx-Proxy auch auf `443` und verwendet die unter `TLS_CERTS_DIR` gemounteten Zertifikate.
- Fuer Hetzner ist die empfohlene Variante, dein Let's-Encrypt-Verzeichnis read-only nach `TLS_CERTS_DIR` zu mounten und `443` direkt ueber den Proxy zu terminieren.
