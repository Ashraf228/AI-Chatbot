# Config Source-of-Truth Audit

Datum: 2026-07-02
Scope: Read-only Audit der Konfigurationsquellen fuer AssistantProfile, Conversation Flow, Widget-Konfiguration, Admin-Testfunktionen und Legacy-Branchenlogik.

## Kurzfazit

Die Anwendung unterstuetzt eine neutrale `AssistantProfile`-Schicht und P1.1B hat die wichtigsten neuen Schreib- und Lesepfade auf das Modul `site_modules["assistant-profile"]` umgestellt. Der Dashboard-Wizard speichert KI-Mitarbeiter- und Gespraechslogik-Einstellungen jetzt ueber den dedizierten AssistantProfile Save-Pfad. Der Admin-Read-Pfad bevorzugt das gespeicherte Modulprofil, sodass Reloads den gleichen Stand anzeigen, den der Resolver nutzt.

`sites.config` bleibt fuer Public-Widget-, Branding-, Domain-, Datenschutz- und Legacy-Fallback-Felder zustaendig. Legacy-Felder wie `industry`, `botType`, `conversationFlow`, `lead-sales.intakeFlow`, `leadCaptureEnabled` und `leadNotificationEmail` bleiben aktiv und werden vom Resolver weiterhin als Fallback benoetigt. Admin-Testflags und Testfaelle gehoeren weiterhin in das `conversation-engine-tests`-Modul. Das Public Widget bleibt unveraendert auf der Legacy-Pipeline und erhaelt keine Admin-/Preview-/Knowledge-Felder.

## Implementation Status

P1.1B ist umgesetzt und runtime-seitig validiert.

- Backend Save Endpoint: `PATCH /admin/sites/:siteId/assistant-profile` speichert nach `site_modules["assistant-profile"].config.assistantProfile`.
- Dashboard Proxy: `PATCH /api/sites/:siteId/assistant-profile` nutzt den Backend-Endpunkt.
- Wizard Write Path: Der Schritt `KI-Mitarbeiter` speichert universelle Assistant-Konfiguration ueber AssistantProfile Save.
- Wizard Write Path: Der Schritt `Gespraechslogik` speichert `requiredFields` und `enabledTasks` ueber AssistantProfile Save.
- Admin Read Path: `GET /admin/widget/sites/:siteId` bevorzugt `site_modules["assistant-profile"].config.assistantProfile`.
- Reload: Der Setup-Wizard liest AssistantProfile-Werte bevorzugt; gespeicherte Select-Werte und Chips bleiben nach Reload sichtbar.
- Universal Mode: `industry=generic` und `botType=universal-assistant` gelten als universell, nicht als Legacy-Handwerker-Modus.
- Legacy Compatibility: Handwerker-/Local-Service- und andere Legacy-Sites bleiben ueber Resolver-Fallbacks kompatibel.
- Public Widget Safety: Public Widget Responses bleiben ohne Admin-, Debug-, Preview-, Compare-, Response-Preview- oder Knowledge-Preview-Felder.
- Production Safety: Keine Production Feature Flags, keine automatische AssistantProfile-Migration, keine Conversation Engine im Public Widget.

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
| `sites.config` | Site-, Public-Widget-, Branding-, Domain-, Datenschutz- und Legacy-Fallback-Felder | Site-Erstellung, Public Widget Config, Legacy/Advanced UI | Public Widget Config, Chat-Kontext, Resolver-Fallback, Dashboard, Statusdienste | Ja, aber nur ausgewaehlte public Felder | Begrenzte Basis-SoT plus Legacy |
| `sites.config.assistantProfile` | Transitional fallback fuer aeltere universelle Sites | Legacy-/Uebergangspfade | AssistantProfileResolver als Fallback | Nein | Deprecated Transitional |
| `site_modules.config["assistant-profile"].assistantProfile` | Source of Truth fuer neue universelle Assistant-Konfiguration | AssistantProfile Save Endpoint, Dashboard Wizard, Opt-in Migration Service | Resolver, Admin Read, Diagnostics, Migration Preview, Conversation Engine Admin-Routen, Dashboard Wizard Reload | Nein | Ziel-SoT, P1.1B umgesetzt |
| `site_modules.config["lead-sales"].intakeFlow` | Legacy Local-Service-/Handwerker-Intake | Module-/Template-Konfiguration | Resolver, Legacy Chat-/Lead-Flow | Indirekt ueber Chatverhalten | Legacy |
| `sites.config.conversationFlow` | Legacy Flow/Pflichtfelder | Setup-Wizard, Widget Config, Templates | Resolver, Legacy Orchestrator/Chat-Kontext, Dashboard | Nicht als Debug-Response | Legacy |
| `sites.config.enabledTasks` | Transitional Aufgabenliste fuer aeltere universelle Sites | Legacy-/Uebergangspfade | Dashboard/Resolver-Fallback | Nein | Deprecated Transitional |
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

Das ist fuer Rueckwaertskompatibilitaet sinnvoll. Nach P1.1B schreiben neue Wizard-Flows fuer KI-Mitarbeiter und Gespraechslogik nicht mehr primaer in `sites.config.assistantProfile`, sondern in das Assistant-Profile-Modul.

## Read/Write Matrix nach P1.1B

| Bereich | Schreibpfad | Lesepfad | Bemerkung |
| --- | --- | --- | --- |
| KI-Mitarbeiter-Step | `PATCH /api/sites/:siteId/assistant-profile` -> `PATCH /admin/sites/:siteId/assistant-profile` -> `site_modules["assistant-profile"].config.assistantProfile` | Wizard initialisiert aus Admin Read mit bevorzugtem Modulprofil | Nicht mehr primaer ueber Widget Config fuer Assistant-Verhalten |
| Gespraechslogik-Step | `requiredFields` und `enabledTasks` nach `site_modules["assistant-profile"].config.assistantProfile` | Wizard und Admin Read bevorzugen Modulprofil | Chips bleiben nach Save/Reload stabil |
| Admin Read | Kein Schreibpfad | `GET /admin/widget/sites/:siteId` bevorzugt `site_modules["assistant-profile"].config.assistantProfile` | `sites.config.assistantProfile` bleibt Fallback |
| Public Widget | Keine AssistantProfile-Schreiboperation | Public Widget Config liest keine Admin-/Preview-Felder | Public Widget bleibt Legacy-Pipeline |
| Legacy/Advanced | Darf alte Felder weiter verwenden | Resolver nutzt Legacy-Felder als Fallback | Keine automatische Migration oder Loeschung |
| Conversation Engine Tests | Admin-Test-Routen schreiben `site_modules["conversation-engine-tests"]` | Nur Admin-/Operator-Testmodus | Keine Live-Umschaltung im Public Widget |

## Konflikte und Drift-Risiken

### AssistantProfile doppelt gespeichert

`AssistantProfile` kann weiterhin in `sites.config.assistantProfile` und in `site_modules.config["assistant-profile"].assistantProfile` existieren. Der Resolver und der Admin-Read-Pfad bevorzugen das Modul. Neue Wizard-Writes gehen nach P1.1B in das Modul. Verbleibendes Risiko: aeltere Sites oder Legacy-/Advanced-Pfade koennen noch alte Kopien in `sites.config.assistantProfile` enthalten.

### Pflichtfelder doppelt modelliert

Pflichtinformationen koennen aus `lead-sales.intakeFlow`, `conversationFlow.requiredFields` und `assistantProfile.requiredFields` stammen. Fuer neue Wizard-Writes ist der Konflikt geloest: `requiredFields` werden nach `assistantProfile.requiredFields` geschrieben. Legacy-Quellen bleiben Fallback und muessen fuer bestehende Sites weiter lesbar bleiben.

### Aufgaben doppelt modelliert

`enabledTasks` existiert als top-level `sites.config.enabledTasks` und als Teil von `assistantProfile.enabledTasks`. Fuer neue Wizard-Writes ist der Konflikt geloest: `enabledTasks` werden nach `assistantProfile.enabledTasks` geschrieben. `sites.config.enabledTasks` bleibt nur Transitional-/Fallback-Feld.

### Uebergabe und Zustellung doppelt modelliert

`leadCaptureEnabled` und `leadNotificationEmail` sind Legacy-Felder. Das neue Modell nutzt `handoffRules` und `deliveryChannels`. Solange beide gepflegt werden, muss die Richtung klar sein: Legacy bleibt Fallback und Kompatibilitaet, das AssistantProfile wird Zielmodell.

### Conversation-Engine-Flags an mehreren Stellen

Flags wie `previewEnabled`, `compareEnabled`, `responsePreviewEnabled`, `knowledgePreviewEnabled` und `adminTestOnly` gehoeren in `site_modules.config["conversation-engine-tests"]`. Sie bleiben Admin-/Operator-Testmodus und duerfen keine Public-Widget-Live-Umschaltung bewirken.

### Legacy-Branchenlogik beeinflusst Public Widget

`industry` wird weiterhin fuer Legacy-Mapping und teilweise fuer Public-Widget-Textnormalisierung genutzt. Das ist fuer bestehende Handwerker-/Local-Service-Sites wichtig, darf aber im normalen neuen Kundenflow nicht mehr als primaere Konfiguration wirken.

### Breiter Widget-Config-Endpunkt

`PATCH /admin/widget/config/:siteId` bleibt fuer Public-Widget- und Legacy-Kompatibilitaetsfelder breit. Neue Wizard-Writes fuer KI-Mitarbeiter und Gespraechslogik nutzen jedoch den dedizierten AssistantProfile Save-Pfad. Verbleibendes Risiko: Legacy-/Advanced- oder Integrationspfade koennen weiterhin alte Felder schreiben und muessen bei spaeterer Deprecation separat betrachtet werden.

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

Ist nach P1.1B die fachliche Source of Truth fuer neue universelle Assistant-Konfiguration:

- `assistantProfile.profileKey`
- `assistantProfile.profileVersion`
- `assistantProfile.assistantName`
- `assistantProfile.role`
- `assistantProfile.primaryGoal`
- `assistantProfile.businessDescription`
- `assistantProfile.targetUsers`
- `assistantProfile.tone`
- `assistantProfile.answerStyle`
- `assistantProfile.knowledgeMode`
- `assistantProfile.enabledTasks`
- `assistantProfile.enabledAgents`
- `assistantProfile.requiredFields`
- `assistantProfile.handoffRules`
- `assistantProfile.deliveryChannels`, nur sanitized in Admin-Diagnose-/Read-Responses
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

### Phase 1: Schreibpfade trennen - erledigt

- Dedizierter API-Schreibpfad fuer `site_modules.config["assistant-profile"]` ist vorhanden.
- Setup-Wizard fuer KI-Mitarbeiter und Gespraechslogik nutzt diesen Pfad.
- Admin Read bevorzugt das Assistant-Profile-Modul.
- Reload-Validierung fuer gespeicherte Select-Werte und Chips ist erfolgt.
- Bestehende Legacy-Felder bleiben unveraendert.

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
- Aeltere Sites koennen weiterhin alte Felder enthalten; das ist kompatibel, darf aber bei zukuenftigen Deprecations nicht als Fehler interpretiert werden.
- Legacy Advanced kann alte Felder weiterhin schreiben; diese Pfade muessen getrennt auditiert werden, bevor Felder deprecated oder entfernt werden.
- Keine automatische Migration ist aktiv; Opt-in Migration pro Site bleibt ein separater Schritt.

## Sicherheitsstatus nach P1.1B

- Keine Production Feature Flags aktiviert.
- Keine AssistantProfile-Migration auf produktiven Sites ausgefuehrt.
- Keine Conversation Engine im Public Widget aktiviert.
- Public Widget Response unveraendert ohne Admin-/Preview-/Knowledge-Felder.
- Legacy-Kompatibilitaet bleibt erhalten.
- Runtime-Validierung erfolgte mit einer internen Testsite.
- Keine echten Kundensites wurden fuer die P1.1B-Validierung mutiert.

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

Nach P1.1B sollte der naechste Schritt die verbleibenden Transitional- und Legacy-Grenzen adressieren:

1. `PATCH /admin/widget/config/:siteId` weiter auf Public-Widget- und Legacy-Kompatibilitaetsfelder begrenzen oder fachlich klarer trennen.
2. Legacy-/Advanced-Schreibpfade fuer `industry`, `botType`, `conversationFlow`, `leadCaptureEnabled` und `leadNotificationEmail` separat auditieren.
3. Opt-in Migration pro Site weiterhin nur nach Preview ohne Blocker erlauben.
4. Public Widget Safety und Legacy-Kompatibilitaet bei jeder weiteren Deprecation erneut pruefen.
