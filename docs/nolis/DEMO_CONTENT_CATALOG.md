# Demo Content Catalog

Der Katalog beschreibt die synthetischen Inhalte des Profils `public-sector-product-support-demo`. Alle Inhalte sind generisch und dienen ausschliesslich der Demonstration eines quellenbasierten Produkt-Support-Agenten.

## Inhaltliche Leitplanken

- Keine echten NOLIS-Unterlagen.
- Keine Zugangsdaten, Kundendaten, Behoerdendaten oder internen Prozesse.
- Keine Behauptung einer Produktivintegration.
- Keine Verwaltungsentscheidung durch die KI.
- Jede Antwort soll auf synthetisch markierte Demo-Quellen begrenzt bleiben.

## Themenabdeckung

Die Seed-Daten enthalten 28 Artikel zu folgenden Themen:

- Anmeldung und Rollen
- Navigation im Dashboard
- Vorgangsstatus
- Formularsuche
- Formularentwurf
- Pflichtfelder
- Anlagen-Upload
- Versionshinweise
- Freigabeprozess
- Benachrichtigungen
- Aufgabenlisten
- Wiedervorlage
- Aktennotizen
- Suchfilter
- Exportvorschau
- Fehlerbehebung bei Uploads
- Browser-Kompatibilitaet
- Barrierearme Bedienung
- Datenschutz-Hinweise
- Protokollansicht
- Mandantenkontext
- Knowledge Gap und sichere Nicht-Antwort
- Uebergabevorschau an Support
- Antwortqualitaet
- Demo-Grenzen
- Notfallkommunikation
- Schulungsmodus
- Kontaktaufnahme bei unklaren Faellen

## Szenarien

| Key | Ziel | Beispielprompt |
| --- | --- | --- |
| `grounded-help` | Quellenbasierte Hilfestellung | Wie veroeffentliche ich einen Formularentwurf? |
| `handoff-preview` | Strukturierte Uebergabevorschau | Mein Formular laesst sich nicht absenden. Was soll ich pruefen? |
| `safe-non-answer` | Sichere Nicht-Antwort | Kann die KI meinen Antrag verbindlich genehmigen? |

## Technische Markierungen

Jede Quelle und jeder Chunk wird mit folgenden Metadaten markiert:

- `demo=true`
- `synthetic=true`
- `demoProfile=public-sector-product-support-demo`
- `demoSeedVersion`
- `demoSeedKey`
- `scenarioKeys`
- `language=de`

Evaluation-Retrieval darf nur Quellen verwenden, die zum aktuellen Tenant und zur aktuellen Site gehoeren und diese Demo-/Synthetic-Markierungen tragen.
