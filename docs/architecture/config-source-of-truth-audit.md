# Config Source-of-Truth Audit

Datum: 2026-07-02
Scope: Read-only Audit der Konfigurationsquellen fuer AssistantProfile, Conversation Flow, Widget-Konfiguration, Admin-Testfunktionen und Legacy-Branchenlogik.

## Kurzfazit

Die Anwendung unterstuetzt bereits eine neutrale `AssistantProfile`-Schicht, aber die Konfigurationsquellen sind noch gemischt. Neue universelle Dashboard-Felder werden aktuell teilweise in `sites.config` gespeichert, waehrend die langfristig passendere Stelle `site_modules.config["assistant-profile"].assistantProfile` ist. Legacy-Felder wie `industry`, `botType`, `conversationFlow`, `lead-sales.intakeFlow`, `leadCaptureEnabled` und `leadNotificationEmail` bleiben aktiv und werden vom Resolver weiterhin als Fallback benoetigt.

Fuer den naechsten Refactor sollte `sites.config` auf Public-Widget-, Branding-, Domain- und Basis-Metadaten begrenzt werden. Assistant-Verhalten, Aufgaben, Pflichtfelder, Uebergabe- und Zustellregeln gehoeren in das Assistant-Profile-Modul. Admin-Testflags und Testfaelle gehoeren in das `conversation-engine-tests`-Modul.

## Relevante Dateien

### API

- `apps/api/src/assistant-profiles/assistant-profile.types.ts`
- `apps/api/src/assistant-profiles/assistant-profile-registry.ts`
- `apps/api/src/assistant-profiles/assistant-profile-resolver.service.ts`
- `apps/api/src/assistant-profiles/assistant-profile-diagnostics.service.ts`
- `apps/api/src/assistant-profiles/assistant-profile-migration-preview.service.ts`
- `apps/api/src/assistant-profiles/assistant-profile-migration.service.ts`
- `apps/api/src/conversation-engine/conversation-engine.controller.ts`
- `apps/api/src/conversation-engine/conversation-engine-test-cases.service.ts`
- `apps/api/src/modules/widget/dto/admin-widget.dto.ts`
- `apps/api/src/modules/widget/services/widget-admin-site.service.ts`
- `apps/api/src/modules/widget/services/widget-config.service.ts`
- `apps/api/src/site-modules/module-configs.ts`
- `apps/api/src/site-modules/site-modules.service.ts`

### Dashboard

- `apps/dashboard/lib/site-create-config.ts`
- `apps/dashboard/lib/setup-wizard-api.ts`
- `apps/dashboard/components/customer/CustomerSetupWizard.tsx`
- `apps/dashboard/components/customer/setup-wizard/*`
- `apps/dashboard/components/integrations/*`

### Tests

- `apps/api/test/assistant-profile-resolver.test.cjs`
- `apps/api/test/assistant-profile-diagnostics.test.cjs`
- `apps/api/test/conversation-engine-preview.test.cjs`
- `apps/api/test/conversation-engine-evaluation-runner.test.cjs`
- `apps/api/test/widget-chat-flow.test.cjs`
- `apps/api/test/admin-widget-dto.test.cjs`
- `apps/dashboard/test/CustomerSetupWizard.test.tsx`

## Aktuelle Konfigurationsquellen

| Quelle | Aktuelle Rolle | Schreiber | Leser | Public Widget | Status |
| --- | --- | --- | --- | --- | --- |
| `sites.config` | Gemischte Site-, Widget-, Legacy- und neue Assistant-Felder | Dashboard Wizard, Admin Widget Config, Site-Erstellung, Templates | Public Widget Config, Chat-Kontext, Resolver, Dashboard, Statusdienste | Ja, aber nur ausgewaehlte public Felder | Ueberladen |
| `sites.config.assistantProfile` | Neutrales Profil als transitional storage | Universal Site Create, Setup-Wizard | AssistantProfileResolver, Dashboard | Nein | Transitional |
| `site_modules.config["assistant-profile"].assistantProfile` | Zielort fuer gespeichertes AssistantProfile | AssistantProfileMigrationService | Resolver, Diagnostics, Migration Preview, Conversation Engine Admin-Routen | Nein | Ziel-SoT |
| `site_modules.config["lead-sales"].intakeFlow` | Legacy Local-Service-/Handwerker-Intake | Module-/Template-Konfiguration | Resolver, Legacy Chat-/Lead-Flow | Indirekt ueber Chatverhalten | Legacy |
| `sites.config.conversationFlow` | Legacy Flow/Pflichtfelder | Setup-Wizard, Widget Config, Templates | Resolver, Legacy Orchestrator/Chat-Kontext, Dashboard | Nicht als Debug-Response | Legacy |
| `sites.config.enabledTasks` | Neue Aufgabenliste, aktuell top-level | Site-Erstellung, Setup-Wizard | Dashboard, Resolver-nahe Adminfunktionen | Nein | Transitional |
| `sites.config.leadCaptureEnabled` | Legacy Lead-Erfassungsschalter | Setup-Wizard, Widget Config | Public Widget Config, Lead-Flow, Resolver Mapping | Ja, als public runtime flag | Legacy/Kompatibilitaet |
| `sites.config.leadNotificationEmail` | Legacy E-Mail-Zustellung | Setup-Wizard, Widget Config | Lead-Mailer, Resolver Mapping, Dashboard | Nein | Legacy/Kompatibilitaet |
| `sites.config.industry` | Legacy Branchen-/Template-Signal | Site-Erstellung, Advanced UI, Templates | Resolver, Widget Config Normalisierung, Dashboard | Indirekt fuer Texte/Fragen | Legacy |
| `sites.config.botType` | Legacy Bot-Typ-Signal | Site-Erstellung, Advanced UI, Templates | Resolver, Dashboard, DTO-Validation | Nein | Legacy |
| `sites.config.templateId/templateVersion` | Legacy Template-Tracking | Template Apply, Site-Erstellung | Resolver, Dashboard | Nein | Legacy |
| `site_modules.config["conversation-engine-tests"]` | Admin-Testflags, Testfaelle und Run-Metriken | ConversationEngineTestCasesService Admin-Routen | Conversation Engine Admin-Routen, Dashboard Testkarten | Nein | Ziel-SoT fuer Admin-Testmodus |

## Aktuelle Resolver-Prioritaet

Der `AssistantProfileResolverService` normalisiert Konfigurationen ohne Produktdaten zu veraendern. Die effektive Reihenfolge ist:

1. Gespeichertes `assistantProfile` aus `site_modules.config["assistant-profile"].assistantProfile` oder kompatiblen Modulpositionen.
2. `sites.config.assistantProfile`.
3. `site_modules.config["lead-sales"].intakeFlow`.
4. `sites.config.conversationFlow`.
5. Legacy-Ableitung aus `botType`, `industry` oder `templateId`.
6. Fallback `universal-assistant@v1`.

Das ist fuer Rueckwaertskompatibilitaet sinnvoll, zeigt aber auch den aktuellen Konflikt: neue Dashboard-Flows schreiben noch haeufig in `sites.config.assistantProfile`, obwohl das Modul der stabilere Zielort ist.

## Konflikte und Drift-Risiken

### AssistantProfile doppelt gespeichert

`AssistantProfile` kann aktuell in `sites.config.assistantProfile` und in `site_modules.config["assistant-profile"].assistantProfile` existieren. Der Resolver bevorzugt das Modul. Das Dashboard schreibt im normalen Wizard aber noch in `sites.config`. Dadurch kann die UI einen anderen Stand anzeigen oder speichern als der Resolver nutzt, sobald ein Modulprofil existiert.

### Pflichtfelder doppelt modelliert

Pflichtinformationen koennen aus `lead-sales.intakeFlow`, `conversationFlow.requiredFields` und `assistantProfile.requiredFields` stammen. Bei widerspruechlichen Feldern ist ohne klare Schreibregel nicht sofort erkennbar, welcher Stand fachlich gilt.

### Aufgaben doppelt modelliert

`enabledTasks` existiert als top-level `sites.config.enabledTasks` und als Teil von `assistantProfile.enabledTasks`. Langfristig sollte nur das Profil fachliche Aufgaben enthalten.

### Uebergabe und Zustellung doppelt modelliert

`leadCaptureEnabled` und `leadNotificationEmail` sind Legacy-Felder. Das neue Modell nutzt `handoffRules` und `deliveryChannels`. Solange beide gepflegt werden, muss die Richtung klar sein: Legacy bleibt Fallback und Kompatibilitaet, das AssistantProfile wird Zielmodell.

### Conversation-Engine-Flags an mehreren Stellen

Flags wie `previewEnabled`, `compareEnabled`, `responsePreviewEnabled`, `knowledgePreviewEnabled` und `adminTestOnly` koennen aus `sites.config.conversationEngine`, aus dem Assistant-Profile-Modul oder aus `conversation-engine-tests` gelesen werden. Fuer Admin-Testfunktionen sollte ausschliesslich `site_modules.config["conversation-engine-tests"]` schreiben und langfristig auch priorisiert lesen.

### Legacy-Branchenlogik beeinflusst Public Widget

`industry` wird weiterhin fuer Legacy-Mapping und teilweise fuer Public-Widget-Textnormalisierung genutzt. Das ist fuer bestehende Handwerker-/Local-Service-Sites wichtig, darf aber im normalen neuen Kundenflow nicht mehr als primaere Konfiguration wirken.

### Breiter Widget-Config-Endpunkt

`PATCH /admin/widget/config/:siteId` akzeptiert Public-Widget-Felder, Legacy-Felder und neue Assistant-Felder in einem DTO. Dadurch ist die Source-of-Truth-Grenze schwer durchzusetzen und versehentliches Ueberschreiben wahrscheinlicher.

## Zielmodell

### `sites.config`

Sollte langfristig nur Felder enthalten, die fuer Site-Metadaten, Public Widget und Darstellung erforderlich sind:

- `siteKey`
- `domain`, `websiteUrl`, `allowedDomains`
- `companyName`, `botName`, `logoUrl`
- `brandColor`, `accentColor`, `fontFamily`, `widgetPosition`
- `welcomeMessage`, `placeholder`, `launcherLabel`, `ctaText`
- `privacyUrl`, `consentRequired`
- `language`, `isActive`
- public runtime metadata wie `widgetBundleUrl`
- kompatible Legacy-Felder nur solange benoetigt: `industry`, `botType`, `templateId`, `templateVersion`, `conversationFlow`, `leadCaptureEnabled`, `leadNotificationEmail`

Neue Assistant-Verhaltenslogik sollte nicht dauerhaft primaer in `sites.config` gespeichert werden.

### `site_modules.config["assistant-profile"]`

Soll die fachliche Source of Truth fuer den KI-Mitarbeiter werden:

- `assistantProfile.profileKey`
- `assistantProfile.profileVersion`
- `assistantProfile.assistantName`
- `assistantProfile.role`
- `assistantProfile.businessDescription`
- `assistantProfile.targetUsers`
- `assistantProfile.tone`
- `assistantProfile.answerStyle`
- `assistantProfile.knowledgeMode`
- `assistantProfile.enabledTasks`
- `assistantProfile.enabledAgents`
- `assistantProfile.requiredFields`
- `assistantProfile.handoffRules`
- `assistantProfile.deliveryChannels`
- `assistantProfile.legacySource`
- `migration`-Metadaten: `migratedFrom`, `migratedAt`, `migratedBy`, `reversible`, `legacyFieldsPreserved`

### `site_modules.config["conversation-engine-tests"]`

Soll die Source of Truth fuer Admin-/Operator-Testmodus bleiben:

- `conversationEngine.previewEnabled`
- `conversationEngine.compareEnabled`
- `conversationEngine.responsePreviewEnabled`
- `conversationEngine.knowledgePreviewEnabled`
- `conversationEngine.adminTestOnly`
- `testCases`
- `lastMetrics`
- `lastRunResult`

Diese Werte duerfen nicht im Public Widget erscheinen und duerfen keine Live-Chat-Umschaltung bewirken.

### Legacy-Fallbacks

Folgende Felder bleiben lesbar und muessen rueckwaertskompatibel bleiben:

- `industry`
- `botType`
- `templateId`
- `templateVersion`
- `conversationFlow`
- `lead-sales.intakeFlow`
- `leadCaptureEnabled`
- `leadNotificationEmail`

Sie sollten nicht automatisch geloescht oder umgeschrieben werden. Neue UI-Flows sollten sie nur noch als Kompatibilitaets-Mirror oder im Advanced-/Legacy-Bereich beruehren.

## Empfohlene Migrationsreihenfolge

### Phase 1: Schreibpfade trennen

- Einen dedizierten API-Schreibpfad fuer `site_modules.config["assistant-profile"]` nutzen oder erstellen.
- Setup-Wizard fuer KI-Mitarbeiter und Gespraechslogik auf diesen Pfad umstellen.
- `sites.config` nur noch fuer Public-Widget- und Basismetadaten aktualisieren.
- Bestehende Legacy-Felder unveraendert lassen.

### Phase 2: Kompatibilitaets-Mirror begrenzen

- Nur Felder spiegeln, die fuer bestehende Legacy-Runtime zwingend noetig sind.
- `sites.config.assistantProfile` als transitional fallback behandeln, nicht als primaeren Schreibort.
- DTOs oder Routen so trennen, dass Public Widget Config nicht neue Assistant-Profile-Felder mitschreibt.

### Phase 3: Diagnose und Preview als Pflichtkontrolle

- Migration Preview muss Drift zwischen `intakeFlow`, `conversationFlow`, `sites.config.assistantProfile` und Modulprofil anzeigen.
- Admin UI soll klar zeigen: aktiver Resolver-Stand, Speicherort, Legacy-Fallbacks, Warnungen.
- Keine automatische Migration ohne explizite Admin-Aktion.

### Phase 4: Legacy nur noch Advanced

- Branchen-/BotType-/Template-Felder nur noch im Advanced-/Legacy-Bereich editierbar machen.
- Public Widget bleibt auf Legacy-Pipeline, bis eine separate Live-Umschaltung spezifiziert und freigegeben ist.
- Erst nach stabiler Migration koennen alte Felder als deprecated markiert und spaeter entfernt werden.

## Sicherheits- und Regressionrisiken

- Bestehende Handwerker-/Local-Service-Sites koennen brechen, wenn `lead-sales.intakeFlow` oder `conversationFlow` zu frueh ignoriert wird.
- Lead-Zustellung kann abweichen, wenn `leadNotificationEmail` nicht korrekt nach `deliveryChannels.email` gemappt wird.
- Admin-Testflags duerfen nicht in Public Widget Responses oder Live-Chat-Entscheidungen leaken.
- Tenant-/Site-Isolation muss bei allen neuen Modul-Schreibpfaden serverseitig erzwungen bleiben.
- Ein zu breiter PATCH-Endpunkt kann versehentlich Legacy- und neue Konfigurationen ueberschreiben.
- `sites.config.industry` hat noch Public-Widget-Nebeneffekte fuer Legacy-Texte und Fragen.
- Conversation-Engine-Compare bleibt Admin-Dry-Run und darf nicht als Live-Entscheidung interpretiert werden.

## Empfohlene Tests

- Neue universelle Site speichert Assistant-Verhalten in `site_modules.config["assistant-profile"]`.
- Neue universelle Site erzeugt keine sichtbaren Handwerker-/Local-Service-Defaults.
- Legacy-Handwerker-Site wird weiter zu `local-service-first-contact@v1` normalisiert.
- `lead-sales.intakeFlow` bleibt vor `conversationFlow` wirksam, wenn beide Legacy-Quellen aktiv sind.
- Gespeichertes Modul-AssistantProfile gewinnt vor `sites.config.assistantProfile`.
- `leadNotificationEmail` wird in Diagnostics und Migration Preview nicht vollstaendig ausgegeben.
- Public Widget Config enthaelt keine Debug-/Preview-/Compare-/Knowledge-Felder.
- Public Widget Chat bleibt Legacy und erzeugt keine Conversation-Engine-Live-Antwort.
- Admin-/Operator-Routen duerfen AssistantProfile und Conversation-Engine-Testdaten sehen.
- Customer und Anonymous erhalten 403/401 fuer Admin-Testfunktionen.
- Setup-Wizard speichert KI-Mitarbeiter, Gespraechslogik und Zustellung ohne Legacy-Felder zu loeschen.
- Migration Preview und Save erhalten Legacy-Felder unveraendert und setzen `legacyFieldsPreserved=true`.

## Naechster sinnvoller Schritt

P1.1B sollte die Schreibpfade konkret trennen:

1. Dedizierte Admin-Route oder Service-Methode fuer `site_modules.config["assistant-profile"]` verwenden.
2. Dashboard-Setup-Wizard fuer KI-Mitarbeiter und Gespraechslogik auf diesen Modul-Schreibpfad umstellen.
3. `PATCH /admin/widget/config/:siteId` auf Public-Widget- und Legacy-Kompatibilitaetsfelder begrenzen oder fachlich klar trennen.
4. Tests fuer Resolver-Prioritaet, Wizard-Speicherung, Public Widget Safety und Legacy-Kompatibilitaet erweitern.

Bis dahin bleibt die aktuelle Lage funktionsfaehig, aber nicht sauber getrennt: `sites.config` ist weiterhin zu breit und enthaelt sowohl Public Widget Metadata als auch neue Assistant-Verhaltensdaten.
