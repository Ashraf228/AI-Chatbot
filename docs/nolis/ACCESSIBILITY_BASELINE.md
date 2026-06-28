# NOLIS Accessibility Baseline

Stand: 2026-06-24
Ausgangs-Commit: `a566bd04fb27a957b2f244c3247fb2eb856e14fc`
Status: technische Baseline fuer den Demonstrator, keine rechtliche Konformitaets- oder Zertifizierungsaussage.

Diese Baseline orientiert sich technisch an WCAG 2.2 Level A/AA. Sie behauptet keine vollstaendige WCAG-, BITV- oder EN-301-549-Konformitaet und keine vollstaendige Screenreader-Kompatibilitaet.

## Automatisch Geprueft

Testbefehl:

```bash
npm run test:accessibility
```

Werkzeug:

- `axe-core` als Dev-Dependency im bestehenden Vitest/jsdom-Testsystem.
- DOM-Scans pruefen auf critical/serious-Verstoesse.
- In jsdom sind `color-contrast` und isolierte `region`-Regeln fuer Komponenten nicht belastbar und werden in den Accessibility-Tests gezielt deaktiviert. Farbkontrast und Landmark-Kontext bleiben manuelle Browserpruefungen.

Gepruefte Dashboard-Zustaende:

- Login-Grundzustand mit sichtbaren Labels.
- Login-Fehlerzustand mit `role="alert"` und verknuepftem Passwortfeld.
- Evaluation Workspace Grundzustand.
- Szenariokarte per Tastatur: Text wird uebernommen, nicht automatisch gesendet, Fokus wechselt zum Eingabefeld.
- Chat mit fertiger Antwort und Quelle.
- Ticketvorschau mit fokussierbarer Vorschau.
- Erfolgreiche Ticketanlage mit Statusmeldung.
- Handoff noch nicht ausgefuehrt und Handoff erfolgreich.
- Session abgelaufen / 403 mit programmatisch wahrnehmbarer Fehlermeldung und geloeschtem lokalen Dialogzustand.

Gepruefte Widget-Zustaende:

- Geschlossener Launcher als benannter Button mit `aria-expanded` und `aria-controls`.
- Geoeffnetes Chatfenster als nicht-modaler benannter Bereich.
- Chatverlauf als `role="log"` ohne aggressive Live-Region.
- Separate `aria-live="polite"`-Region fuer fertige Assistentenantworten.
- Ladezustand mit `role="status"`.
- Fehlerzustand mit `role="alert"`.
- Consent-Hinweis mit erreichbarem Datenschutzlink; Composer bleibt bis Consent deaktiviert.
- LeadCaptureModal als echter Dialog mit `aria-modal`, Fokusfalle, Escape-Schliessen und Fokus-Rueckgabe.
- Leadformular mit sichtbaren Labels, Autocomplete und Fehlerzustand.

Fokus- und Tastaturtests:

- Launcher ist per Button-Semantik bedienbar.
- Szenariokarte ist per Tastatur aktivierbar.
- Szenarioauswahl sendet nicht automatisch.
- Evaluation-Eingabefeld erhaelt nach Szenarioauswahl Fokus.
- Ticketvorschau erhaelt nach Anzeige Fokus.
- Lead-Modal initialisiert Fokus auf Schliessen.
- Tab und Shift+Tab bleiben im Lead-Modal.
- Escape schliesst das Lead-Modal.
- Fokus kehrt nach Unmount zum ausloesenden Element zurueck.

Live-Region-Strategie:

- Sichtbarer Chatverlauf ist nicht aggressiv live.
- Fertige Assistentenantworten werden in einer separaten, visuell versteckten `aria-live="polite"`-Region einmal als neue Antwort bereitgestellt.
- Normale Ladezustaende verwenden `role="status"`.
- Fehler verwenden `role="alert"`.
- Handoff-Status wird als Text angezeigt und ueber die Statusregion aktualisiert, ohne automatische Statuspolling-Fokuswechsel.

## Widget-Semantik

Das Widget-Chatfenster ist aktuell ein nicht-modaler Bereich:

- Die Hostseite soll weiterhin bedienbar bleiben.
- Deshalb wird kein `aria-modal="true"` am Chatfenster gesetzt.
- Es gibt keine kuenstliche Fokusfalle im Chatfenster.
- Beim Schliessen wird der Fokus zum Launcher zurueckgegeben.

Der LeadCaptureModal ist dagegen ein echter Modal-Dialog:

- `role="dialog"`
- `aria-modal="true"`
- zugänglicher Name ueber die Formularueberschrift
- Fokusfalle fuer Tab/Shift+Tab
- Escape schliesst
- Fokus kehrt zum Ausloeser zurueck

## Struktur- und Formularstrategie

- Dashboard-Root nutzt `<html lang="de">`.
- Dashboard-Layout besitzt einen Skip-Link zum Hauptinhalt.
- Login-Felder haben sichtbare Labels; Passwort nutzt `autocomplete="current-password"`.
- Evaluation-Nachrichteneingabe hat ein programmatisches Label und Hilfetext.
- Widget-Composer hat ein programmatisches Label und Hilfetext fuer Enter/Umschalt+Enter.
- Leadformular-Felder haben sichtbare Labels und passende Autocomplete-Attribute.
- Fehler sind programmatisch wahrnehmbar.
- Statusinformationen werden nicht nur ueber Farbe vermittelt.

## Bekannte Grenzen Der Automatisierung

Das aktuelle Testsystem ist jsdom-basiert und kein echter Browser. Deshalb wurden nicht als bestanden behauptet:

- realer Farbkontrast
- 200-Prozent-Zoom
- 320-CSS-Pixel-Reflow
- Text-Spacing
- sichtbarer Fokus im echten Rendering
- Focus Not Obscured
- Target Size im Layout
- reduzierte Bewegung im echten Browser
- Windows Forced Colors
- VoiceOver/Safari oder NVDA/Firefox/Chrome
- vollstaendiger Tastatur-only-End-to-End-Ablauf im Browser
- mobile Touchbedienung

## Manuelle Pruefmatrix

| Pruefung | Testschritte | Erwartetes Ergebnis | Status | Datum | Browser/AT | Tester |
| --- | --- | --- | --- | --- | --- | --- |
| 200 % Zoom | Dashboard Login, Evaluation Workspace und Widget bei 200 % Browserzoom bedienen. | Keine notwendige horizontale Seitennavigation; Chat, Ticketvorschau und Formular bleiben bedienbar. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| 320 CSS-Pixel Reflow | Viewport auf ca. 320 CSS-Pixel setzen und Kernfluss bedienen. | Inhalte umbrechen, keine verdeckten Pflichtaktionen. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Text-Spacing | WCAG-Textabstaende per Browsertool/Bookmarklet anwenden. | Keine Ueberlagerung oder abgeschnittene Pflichtinformation. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Farbkontrast | Text, Links, Badges, Fehler, Erfolg, Fokus und dynamische Brandingfarben pruefen. | Relevante Texte sind lesbar; Fokus-, Fehler- und Erfolgszustaende bleiben unterscheidbar. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Sichtbarer Fokus | Alle Kernaktionen per Tab/Shift+Tab durchlaufen. | Fokusindikator ist sichtbar und eindeutig. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Focus Not Obscured | Fokus durch scrollbare Bereiche, Chatcomposer und Modal pruefen. | Fokussierte Elemente werden nicht vollstaendig verdeckt. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Target Size | Launcher, Schliessen, Quellen, Confirm/Cancel, Retry und Consent pruefen. | Primaere Ziele sind bedienbar und nicht zu eng platziert. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Reduced Motion | `prefers-reduced-motion: reduce` aktivieren. | Nicht notwendige Animationen/Transitions sind reduziert, Status bleibt verstaendlich. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Windows Forced Colors | Forced-Colors-Modus pruefen, soweit verfuegbar. | Bedien- und Statusinformationen bleiben erkennbar. | not applicable | 2026-06-28 | macOS/Chrome | Ashraf Soule |
| Screenreader | VoiceOver mit Login, Evaluation, Widget, Ticket und Handoff pruefen. | Struktur, Status und Chatantworten sind nachvollziehbar. | passed | 2026-06-28 | Chrome + VoiceOver/macOS | Ashraf Soule |
| Tastatur-only Gesamtablauf | Ohne Maus: Login, Szenario, Chat, Ticket, Handoff, Widget, Consent, Leadformular. | Keine Tastaturfalle ausser im echten Modal; Fokusverlauf bleibt nachvollziehbar. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |
| Mobile Touchbedienung | Widget und Dashboard auf kleinem Touchscreen pruefen. | Zielgroessen und Reflow bleiben bedienbar. | passed | 2026-06-28 | Chrome/macOS | Ashraf Soule |

## Manuelle Evidence 2026-06-28

Tester: Ashraf Soule
OS: macOS
Browser: Chrome

- Tastatur-only Kernablauf: Login, Szenarioauswahl, Chat, Quellenanzeige, Ticketvorschau, Confirm, Handoff und Logout waren vollstaendig per Tastatur bedienbar. Fokus war sichtbar und nicht verdeckt.
- Zoom/Reflow: Der Kernablauf wurde bei 200 % Zoom und ca. 320 CSS-Pixel Breite geprueft. Pflichtaktionen blieben erreichbar.
- Screenreader: Der Kernablauf wurde mit VoiceOver geprueft. Struktur, Statusmeldungen und relevante Aktionen waren nachvollziehbar.
- Secret-/DOM-Sichtpruefung: Im sichtbaren Browser-Flow wurden keine Passwoerter, Sessiontokens, HMAC-Secrets, API-Keys, vollstaendige interne Payloads oder nicht erforderliche interne IDs angezeigt.
- Ergebnis laut manueller Pruefung: keine kritischen Accessibility-Blocker im Kernablauf festgestellt.

## Sicherheitsabgrenzung

Die Accessibility-Anpassungen aendern keine:

- Viewer-Allowlist
- Auth-Grenze
- Tenant- oder Site-Isolation
- HMAC-Signaturpruefung
- Ticket-Confirm-/Cancel-Freigaben
- Retrieval-Scopes
- Consent-Datenschutzgrenze
- Analytics-Eventnamen

Es wurden keine echten Kundendaten, Zugangsdaten oder NOLIS-Unterlagen in Tests oder Dokumentation aufgenommen.

## Naechste Schritte

- Manueller Browser-/Screenreader-Test auf Staging.
- Golden-Question-Testset.
- Umfassender Tenant-/Viewer-Security-Gate.
- Finaler Release-Gate.
- Staging-Provisionierung und manuelle Accessibility-Abnahme.

Externer NOLIS-Zugang bleibt bis dahin NO-GO.
