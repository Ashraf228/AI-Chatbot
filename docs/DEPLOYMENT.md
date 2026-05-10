# Deployment

## Topologie

Empfohlene Domain-Aufteilung:

- Dashboard: `admin.example.com`
- API: `api.example.com`
- Widget: `widget.example.com`

Docker Compose startet:

- `proxy`: einziger oeffentlicher Entry Point auf `80/443`
- `dashboard`: intern auf `3000`
- `api`: intern auf `5000`
- `widget`: intern auf `80`
- `db`: internes PostgreSQL/pgvector
- `redis`: internes Redis mit Passwort
- `reporter`: optionales Profil

## Production Start

```bash
cp .env.example .env
npm run docker:config
docker compose up --build -d
```

Mit Reporter:

```bash
docker compose --profile reporter up --build -d
```

## HTTPS

Variante A: Interner Nginx terminiert TLS.

```env
TLS_ENABLED=true
TLS_CERTS_DIR=/etc/letsencrypt/live/example.com
TLS_CERT_PATH=/etc/nginx/certs/fullchain.pem
TLS_KEY_PATH=/etc/nginx/certs/privkey.pem
```

Variante B: Externer Proxy wie Caddy, Traefik oder Host-Nginx terminiert TLS und leitet auf den Compose-Proxy weiter. Dann `TLS_ENABLED=false` im Compose-Proxy lassen.

## Pflicht-ENV

Production muss mindestens setzen:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `OPENAI_API_KEY`
- `ADMIN_KEY`
- `DASHBOARD_INTERNAL_TOKEN`
- `ADMIN_PANEL_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `INTEGRATION_SECRET_KEY`
- `PUBLIC_API_BASE_URL`
- `PUBLIC_WIDGET_BUNDLE_URL`
- `NEXT_PUBLIC_WIDGET_LOADER_URL`
- `ADMIN_DOMAIN`
- `API_DOMAIN`
- `WIDGET_DOMAIN`

Optionale, aber empfohlene Werte:

- `OPERATOR_PANEL_PASSWORD_HASH`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `REPORTS_FROM_EMAIL`
- `LEAD_NOTIFICATION_EMAIL`
- `ADMIN_EMAIL`
- `APP_URL`
- `CORS_ALLOWED_ORIGINS`

## Healthchecks

- API: `https://api.example.com/healthz`
- Dashboard: `https://admin.example.com/healthz`
- Widget Loader: `https://widget.example.com/loader.js`
- Proxy: `http://localhost/healthz` im Container/Host-Kontext

API Health liefert `status`, `database`, `redis`, `uptimeSeconds` und `version`, aber keine Secrets.

## Typische Fehler

- Dashboard Login geht nicht: `ADMIN_PANEL_PASSWORD_HASH` oder `ADMIN_SESSION_SECRET` fehlt/falsch.
- Dashboard kann API nicht erreichen: `DASHBOARD_INTERNAL_TOKEN` muss in API und Dashboard identisch sein.
- Widget nicht sichtbar: `allowed_domains`, `SITE_DOMAIN_ALLOWLIST_MODE`, `PUBLIC_API_BASE_URL` und Loader-URL pruefen.
- Integrationen entschluesseln nicht: `INTEGRATION_SECRET_KEY` muss stabil bleiben; Rotation ueber Previous/Legacy Keys planen.
- API startet nicht: `DATABASE_URL`, `POSTGRES_PASSWORD`, Migrationen und DB-Health pruefen.
