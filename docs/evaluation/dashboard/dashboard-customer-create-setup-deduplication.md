## Summary

Die Kundenanlage wurde auf Metadaten reduziert. Primäre Agent-Konfiguration findet nicht mehr im Create-Flow statt, sondern im Setup.

## Previous Problem

Die Kundenanlage sammelte zuvor mehrere KI-nahe Angaben bereits beim Anlegen:

- Unternehmensbeschreibung
- Zielgruppe / Nutzer
- KI-Mitarbeiter-Rolle
- Hauptaufgaben der KI
- optionale Übergabe-E-Mail

Diese Angaben überlappten funktional mit dem späteren Setup und erzeugten Drift-Risiken zwischen Customer Create, Setup-Wizard und gespeichertem Backend-Status.

## Product Decision

- Customer Create ist nur noch für Kunden-Metadaten zuständig.
- Agent Setup bleibt die Source of Truth für Rolle, Zielgruppe, Aufgaben, Pflichtfelder, Übergabe, Wissen, Tests und Livegang.
- Legacy-Template-Auswahl bleibt als kompatibler Sonderpfad unter erweiterten Angaben erhalten.

## Customer Create Scope

Customer Create enthält jetzt nur noch:

- Kundenname
- Website oder Hauptdomain
- interne / technische Angaben unter erweitertem Bereich
- optionale Legacy-Template-Auswahl unter erweitertem Bereich

Nicht mehr Teil von Customer Create:

- Unternehmensbeschreibung
- Zielgruppe / Nutzer
- KI-Mitarbeiter-Rolle
- Hauptaufgaben der KI
- Übergabe-E-Mail

## Agent Setup Scope

Der Setup-Wizard bleibt zuständig für:

- Primärziel / Bot-Typ / Tonalität
- Assistant-Profile / Rollen- und Aufgabenlogik
- Required Fields und Conversation Flow
- Lead-Delivery und Übergabe-E-Mail
- Wissen, Test, Review und Livegang

## Source of Truth

Agent Setup ist die Source of Truth für KI-Rolle, Aufgaben und Zielgruppe. Customer Create speichert keine finale Agent-Konfiguration mehr in `assistantProfile`, `enabledTasks` oder Lead-Delivery-Feldern.

## Backend Compatibility

- Keine API-Datei wurde geändert.
- Keine Migration wurde verwendet.
- Das Create-Payload-Format bleibt kompatibel.
- Die initiale Site-Konfiguration bleibt neutral:
  - `industry`
  - `botType`
  - `conversationEngine` Preview-/Admin-Test-Flags
- Legacy-Template-Auswahl bleibt kompatibel.

## Tests Added

- `apps/dashboard/test/SiteForm.test.tsx`
  - bestätigt, dass der normale Create-Flow nur noch Metadaten zeigt
  - bestätigt den expliziten Handoff ins Setup
- `apps/dashboard/test/site-create-config.test.tsx`
  - bestätigt, dass initial keine Agent-Konfiguration mehr gespeichert wird
  - bestätigt Legacy-Kompatibilität für `industry` / `botType`

Zusätzliche Regressionen:

- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- `apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`
- `apps/dashboard/test/ConversationEngineDemoWorkspaceConfigRoute.test.tsx`
- `apps/dashboard/test/ConversationEnginePdfExtractRoute.test.tsx`
- `apps/dashboard/test/ConversationEngineRuntimePilotRoute.test.tsx`
- `apps/api/test/site-status.service.test.cjs`

## Remaining Follow-up Fixes

- Setup-Flow für Knowledge Save / Continue weiter schärfen
- Customer-Create-/Setup-Handoff weiterhin nur neutral halten
- keine Erweiterung zu Guided Demo, Self-Service oder Pilot in diesem Schritt

## Safety Boundaries

- Kein Deploy
- Kein Public Widget
- Keine Produktionsaktivierung
- Keine DB-Migration
- Keine Package-/Lockfile-Änderung
- Keine Kundendaten
- Keine Production-Daten
- Keine Screenshots oder Recordings
- Keine Knowledge-/PDF-/Chat-Persistence-Erweiterung

## Next Task

`DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1`
