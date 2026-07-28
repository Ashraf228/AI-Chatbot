## Summary

Customer Create und Agent Setup wurden funktional entdoppelt. Customer Create speichert nur noch Metadaten; Agent Setup bleibt die Source of Truth für Agent-Konfiguration.

## UI Changes

- Aus der normalen Kundenanlage entfernt:
  - Unternehmensbeschreibung
  - Zielgruppe / Nutzer
  - KI-Mitarbeiter-Rolle
  - Hauptaufgaben der KI
  - Übergabe-E-Mail
- Setup-Handoff im Create-Form explizit gemacht
- Legacy-Template-Optionen unter erweitertem Bereich beibehalten

## Source of Truth

Agent Setup bleibt die Source of Truth für:

- Rolle
- Zielgruppe
- Aufgaben
- Required Fields
- Lead Delivery
- Wissen
- Test und Livegang

Customer Create speichert keine finale Agent-Konfiguration mehr in `assistantProfile`, `enabledTasks` oder Lead-Delivery-Feldern.

## Backend Compatibility

- Kein API-Code geändert
- Kein Schema / keine Migration
- Neutrales Initial-Config-Objekt bleibt kompatibel
- Legacy-Auswahl für `industry` / `botType` bleibt erhalten

## Tests Added

- `apps/dashboard/test/SiteForm.test.tsx`
- `apps/dashboard/test/site-create-config.test.tsx`
- Setup-/Conversation-Regressionen im Dashboard
- `apps/api/test/site-status.service.test.cjs` als angrenzender API-Regressionslauf nach `build:api`

## Still Blocked

- Guided customer demo: blocked
- Self-service customer demo: blocked
- Real pilot: blocked
- Kein Deploy
- Kein Public Widget
- Keine Enterprise-Freigabe

## Safety Confirmation

- Nur Dashboard-Code plus Doku/Reports geändert
- Keine Package-/Lockfile-Änderung
- Keine Runtime-/Widget-/Workflow-/SQL-/DB-Änderung
- Keine Kundendaten
- Keine Production-Daten
- Keine Credentials

## Recommended Next Step

`DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1`
