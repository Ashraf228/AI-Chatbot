# Widget Hosting

Das gehostete Modell ist so gedacht, dass der Kunde nur ein einziges Loader-Script einbindet. Alles andere kommt von deiner Infrastruktur.

## Einbindung auf Kundenseiten

```html
<script
  src="https://cdn.deine-domain.tld/widget/loader.js"
  data-site-key="site_live_123"
  data-api-base="https://api.deine-domain.tld"
  async
></script>
```

Optional koennen spaeter noch weitere Attribute unterstuetzt werden:

- `data-config-path="/widget/config"`
- `data-widget-src="https://cdn.deine-domain.tld/widget/widget.js"`

## Ablauf

1. Der Loader liest `data-site-key` aus dem Script-Tag.
2. Der Loader ruft deine Public Widget API auf, z. B. `GET /widget/config?siteKey=...`.
3. Das API liefert die oeffentliche Runtime-Konfiguration fuer genau diese Site zurueck.
4. Der Loader schreibt diese Konfiguration in `window.SSB_CHAT`.
5. Danach laedt der Loader das eigentliche Widget-Bundle von deinem CDN oder App-Host.
6. Das Widget mountet sich selbst und startet den Chat.

## Verantwortung

- Kunde:
  - bindet nur den Loader ein
  - bekommt keinen internen Admin-, Backend- oder Dashboard-Zugriff

- Du:
  - hostest Loader und Widget-Bundle
  - stellst Public Config und Chat API bereit
  - verwaltest Sites, Branding, Wissensbasis, Leads und Reports

## Erwartete Public Config Response

```json
{
  "siteId": "kunde-1",
  "publicKey": "pk_live_...",
  "apiBase": "https://api.deine-domain.tld",
  "title": "Support",
  "greeting": "Hi! Wie kann ich helfen?",
  "placeholder": "Nachricht schreiben...",
  "buttonText": "Chat",
  "position": "bottom-right",
  "consentRequired": true,
  "leadCaptureEnabled": true,
  "widgetBundleUrl": "https://cdn.deine-domain.tld/widget/widget.js"
}
```
