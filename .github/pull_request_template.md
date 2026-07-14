## Change class

- [ ] `DOKU_ONLY`
- [ ] `PURE_API_BOUNDARY`
- [ ] `API_RUNTIME_UNWIRED`
- [ ] `API_RUNTIME_WIRED`
- [ ] `SCRIPT_CHANGE`
- [ ] `PUBLIC_WIDGET_CHANGE`
- [ ] `DASHBOARD_CHANGE`
- [ ] `DB_MIGRATION`
- [ ] `DB_DATA_CHANGE`
- [ ] `PRODUCTION_CONFIG_CHANGE`
- [ ] `DEPLOY_ONLY`
- [ ] `MONITORING_FIX`

## Scope

- Ziel des PR
- erlaubter Scope
- verbotener Scope / Non-goals

## Files changed

- betroffene Dateien oder Bereiche

## Tests

- [ ] alle Pflichtchecks gemaess Change-Klasse ausgefuehrt
- [ ] `git diff --check` gruen
- weitere relevante Tests:

## Security

- [ ] keine Secrets ausgegeben oder committed
- [ ] relevante Security-Checks gruen
- [ ] keine PR-fremden Aenderungen

## Migration impact

- [ ] keine
- [ ] vorhanden, separat beschrieben

## Deploy impact

- [ ] keine
- [ ] vorhanden, explizit beauftragt

## Public widget impact

- [ ] keine
- [ ] vorhanden, Widget-Gates dokumentiert

## Feature flags

- [ ] keine Aenderung
- [ ] Aenderung explizit beauftragt und dokumentiert

## Secrets

- [ ] keine `.env`, Reports, Backups oder Secrets im Diff

## Rollback

- Rollback-Punkt oder `nicht erforderlich`

## Non-goals

- explizit bestaetigen, was nicht eingefuehrt oder nicht veraendert wurde
