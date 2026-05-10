# Local Development

## Voraussetzungen

- Node.js 20+
- npm
- Docker und Docker Compose

## Setup

```bash
npm install
cp .env.example .env
npm run generate:server-secrets
```

Die generierten Werte in `.env` uebernehmen. Fuer lokale Entwicklung kann `ADMIN_PANEL_PASSWORD` gesetzt bleiben; in Production nur Hashes verwenden.

## Infrastruktur Starten

```bash
npm run docker:up
```

Oder nur DB/Redis ueber Compose starten und Apps lokal ausfuehren, falls gewuenscht.

## Apps Lokal Starten

```bash
npm run dev:api
npm run dev:widget
npm run dev:reporter
npm run dev --workspace=apps/dashboard
```

Dashboard: `http://localhost:3000`
API: `http://localhost:5000/healthz`
Widget Dev: Vite-URL aus der Konsole.

## Migrationen

```bash
npm run db:migrate
```

Die API fuehrt Migrationen beim Start ebenfalls automatisch aus.

## Testdaten

1. Im Dashboard einloggen.
2. Kunden/Site anlegen.
3. Domain fuer lokalen Test erlauben, z. B. `localhost` oder die verwendete Testdomain.
4. Setup-Wizard durchlaufen.
5. Wissen hinzufuegen.
6. Testchat ausfuehren.
7. Embed-Code auf einer lokalen HTML-Seite testen.

## Checks

```bash
npm run check:api
npm run build:api
npm run test:smoke
npm run check:dashboard
```
