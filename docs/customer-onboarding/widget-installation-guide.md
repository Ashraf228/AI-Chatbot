# Widget Installation Guide

Stand: 2026-05-28

Technische Einbau-Anleitung fuer Kundenwebsites. Keine echten Site Keys in diese Vorlage eintragen.

## Script-Code-Platzhalter

```html
<script
  src="[WIDGET_LOADER_URL]"
  data-site-key="[SITE_KEY]"
  async
></script>
```

Platzhalter:

- `[WIDGET_LOADER_URL]`: URL des Widget Loaders.
- `[SITE_KEY]`: Site Key des Kunden.

## Wo auf der Website einbauen?

- Im globalen Layout oder Footer der Website.
- Vorzugsweise auf allen Seiten, auf denen Besucher Fragen stellen oder Kontakt aufnehmen sollen.
- Nicht mehrfach auf derselben Seite einbinden.
- Nach Einbau Cache/CDN leeren oder aktualisieren, falls die Website Caching nutzt.

## Vor Einbau pruefen

- Datenschutzlink ist gesetzt.
- Datenschutzlink ist erreichbar.
- Erlaubte Domain/Allowed Origin ist korrekt.
- `consentRequired` ist passend zur Kundenfreigabe konfiguriert.
- Site Key gehoert zur richtigen Kundensite.
- Widget-Branding ist freigegeben.

## Test nach Einbau

- Widget ist sichtbar.
- Widget oeffnet sauber.
- Chat startet mit gueltiger Domain.
- Testfrage wird beantwortet.
- Testlead mit TEST-Daten wird gespeichert.
- Lead-Zustellung und Delivery-Badge werden geprueft.
- Ungueltige Domain wird geblockt.
- Testlead wird geloescht oder klar als Test markiert.

## Rollback

- Script aus Website entfernen.
- Widget/Site im Dashboard deaktivieren oder Domain entfernen, falls erforderlich.
- Cache/CDN erneut aktualisieren.
- Monitoring pruefen.
- Kunde ueber Rueckbau informieren, falls relevant.
