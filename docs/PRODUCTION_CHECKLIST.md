# Production Checklist

## Secrets Und ENV

- [ ] `.env` liegt nur auf dem Server und ist nicht committed.
- [ ] `NODE_ENV=production`
- [ ] `POSTGRES_PASSWORD` stark gesetzt.
- [ ] `REDIS_PASSWORD` stark gesetzt.
- [ ] `OPENAI_API_KEY` gesetzt.
- [ ] `ADMIN_KEY` gesetzt.
- [ ] `DASHBOARD_INTERNAL_TOKEN` in API und Dashboard identisch.
- [ ] `ADMIN_PANEL_PASSWORD_HASH` gesetzt.
- [ ] `OPERATOR_PANEL_PASSWORD_HASH` gesetzt, falls Mitarbeiter-Login genutzt wird.
- [ ] `ADMIN_SESSION_SECRET` stark gesetzt.
- [ ] `INTEGRATION_SECRET_KEY` stabil und sicher gesetzt.

## Netzwerk

- [ ] Nur Proxy-Ports `80/443` sind oeffentlich.
- [ ] Postgres ist nicht oeffentlich exposed.
- [ ] Redis ist nicht oeffentlich exposed.
- [ ] HTTPS ist aktiv.
- [ ] Security Headers sind im Proxy aktiv.
- [ ] `CORS_ALLOWED_ORIGINS` ist restriktiv gesetzt.

## Widget

- [ ] `PUBLIC_API_BASE_URL` zeigt auf die Production API.
- [ ] `PUBLIC_WIDGET_BUNDLE_URL` zeigt auf `widget.js`.
- [ ] `NEXT_PUBLIC_WIDGET_LOADER_URL` zeigt auf `loader.js`.
- [ ] Kundendomains sind in `allowed_domains` gepflegt.
- [ ] `SITE_DOMAIN_ALLOWLIST_MODE=strict` in Production.

## Betrieb

- [ ] DB Backup ist eingerichtet.
- [ ] Restore wurde getestet.
- [ ] Healthchecks sind gruen.
- [ ] `npm run test:smoke --workspace=apps/api` ist gruen.
- [ ] Dashboard Login wurde getestet.
- [ ] Widget Testchat wurde auf echter Domain getestet.
- [ ] Lead-Mail oder Webhook wurde getestet.
- [ ] Logs werden beobachtet.
- [ ] Monitoring/Alerting ist geplant.

## Datenschutz

- [ ] Privacy URL je Kunde vor Live gepflegt.
- [ ] Export/Delete im Dashboard getestet.
- [ ] Retention-Policy pro Kunde definiert.
- [ ] DPA/AVV und Datenschutzhinweise rechtlich geprueft.
