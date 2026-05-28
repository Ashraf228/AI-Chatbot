# First Customer Go-Live Playbook

Stand: 2026-05-28

Dieses Playbook beschreibt einen standardisierten Ablauf fuer die Einrichtung eines neuen Kunden. Es ist eine operative Vorlage, keine Rechtsberatung, kein Vertrag und kein SLA.

## A) Ziel des Playbooks

- Einheitlicher Ablauf fuer neue Kunden-Sites.
- Technische, rechtliche und operative Pruefung vor Go-live.
- Fruehe Erkennung von Konfigurations-, Datenschutz- und Zustellrisiken.
- Saubere Uebergabe an Kunde, Support und Betrieb.

## B) Voraussetzungen

- Kunde hat eine erreichbare Website.
- Impressum ist vorhanden.
- Datenschutzerklaerung ist vorhanden.
- AVV-/Datenschutzpruefung ist vorbereitet oder abgeschlossen.
- Lead-Zieladresse oder anderes Lead-Ziel ist vorhanden.
- Wissensbasis-Inhalte wurden geliefert und freigegeben.
- Freigabe zur Widget-Einbindung liegt vor.
- Ansprechpartner fuer fachliche Inhalte, Datenschutz und Support sind benannt.

## C) Onboarding-Ablauf

1. Kunde und Site im Dashboard oder Admin-Prozess anlegen.
2. Passendes Template auswaehlen.
3. Sub-Branche auswaehlen, falls relevant.
4. Domain und Allowed Origin setzen.
5. Datenschutzlink setzen.
6. `consentRequired` passend zur Kundenfreigabe aktivieren.
7. Widget-Farben, Begruessung und CTA konfigurieren.
8. Wissensbasis hochladen oder manuell erfassen.
9. Agenten und Module aktivieren.
10. Lead-Zustellung per E-Mail und optional Webhook testen.
11. Dashboard fuer Leads, Conversations, Usage und Setup pruefen.
12. Monitoring pruefen.
13. Backup und Offsite-Backup pruefen.
14. Testlead loeschen oder klar als Test markieren.
15. Kunde fuer Go-live freigeben, wenn technische und rechtliche Checks abgeschlossen sind.

## D) Go-Live-Abnahme

Technische Checks:

- Widget loader laedt.
- Widget Config laedt.
- Session startet mit gueltiger Domain.
- Ungueltige Domain wird geblockt.
- Chat beantwortet Testfragen korrekt.
- Lead wird gespeichert.
- Lead-Zustellung funktioniert oder Fehlerstatus ist sichtbar.
- Dashboard zeigt Leads, Conversations und Delivery-Badges.
- Monitoring, Backup, Offsite-Backup und Job Health sind gruen.

Rechtliche und organisatorische Checks:

- Impressum und Datenschutzerklaerung sind erreichbar.
- Chat/Widget ist in der Datenschutzerklaerung beruecksichtigt.
- AVV/TOMs/Subprozessoren/Drittlandtransfer sind nach Kundenprozess geprueft.
- Speicherfristen sind abgestimmt.
- Loesch-/Exportprozess ist bekannt.
- Supportkontakt ist festgelegt.

Testfragen:

- Preisfrage.
- Problemfrage.
- Rueckrufwunsch.
- Einsatzgebiet.
- Sensible-Daten-Test.
- Zwei bis drei kundenspezifische FAQ.

## E) Nach Go-live

- Erste 24 Stunden technisch beobachten.
- Lead-Zustellung und Delivery-Badges pruefen.
- Fehlgeschlagene Jobs pruefen.
- Haeufige Fragen sammeln.
- Wissensbasis und Fallbacks nachschaerfen.
- Kunde um Feedback zu Antwortqualitaet und Lead-Qualitaet bitten.
- Offene rechtliche oder organisatorische Punkte nachverfolgen.
