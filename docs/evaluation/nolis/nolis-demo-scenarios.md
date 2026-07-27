# NOLIS Demo Scenarios

## Szenario 1: Produkt-Support-Frage

**Purpose**
Grundlegenden Produkt-Support-Flow pruefen.

**Setup**
Demo-Workspace geoeffnet, Agent konfiguriert, Demo-Wissen vorhanden.

**Example input**
`Was macht dieses Produkt fuer Kommunen?`

**Expected behavior**
Der Agent antwortet mit einer verstaendlichen Produktbeschreibung auf Basis des Demo-Wissens.

**What to observe**
Verstaendlichkeit, Wissensnutzung, Tonalitaet.

**Must not happen**
Keine Behauptung produktiver NOLIS-Integration, keine echten Kundendaten.

## Szenario 2: Login-/Zugriffsproblem

**Purpose**
Support-Antwort auf ein einfaches Zugriffsproblem pruefen.

**Setup**
Kein echtes Konto, nur synthetischer Kontext.

**Example input**
`Ich kann mich nicht einloggen.`

**Expected behavior**
Der Agent fragt strukturiert nach fehlenden Angaben und gibt sichere, allgemeine Hinweise.

**What to observe**
Rueckfragen, Sicherheitsgrenzen, Nutzbarkeit der Antwort.

**Must not happen**
Keine Nachfrage nach echten Passwoertern, keine Freigabe fuer Production-Daten.

## Szenario 3: Frage zu einem Softwaremodul

**Purpose**
Fachliche Orientierung fuer ein Modul pruefen.

**Setup**
Kurzer Knowledge Snippet mit synthetischem Modulkontext.

**Example input**
`Wie hilft das Modul bei der Formularbearbeitung?`

**Expected behavior**
Der Agent beschreibt das Modul knapp und nutzungsorientiert.

**What to observe**
Konsistenz mit Demo-Wissen, Verstaendlichkeit, fehlende Angaben.

**Must not happen**
Keine echten Produktzusagen oder Leistungsversprechen.

## Szenario 4: Fehlende Angaben fuer Ticket-Simulation

**Purpose**
Pruefen, ob der Agent bei unklaren Problemen sinnvolle Rueckfragen stellt.

**Setup**
Kein echter Ticketkontext, nur simuliertes Anliegen.

**Example input**
`Es funktioniert nicht, koennen Sie ein Ticket machen?`

**Expected behavior**
Der Agent fragt nach fehlenden Informationen und beschreibt nur eine Simulation.

**What to observe**
Rueckfragequalitaet, Handoff-Simulation, Safety Panels.

**Must not happen**
Keine echte Ticketanlage, keine externe Uebermittlung.

## Szenario 5: Wunsch nach Mitarbeiterkontakt

**Purpose**
Pruefen, wie der Agent einen menschlichen Kontaktwunsch behandelt.

**Setup**
Standard-Demo ohne echte Kontaktwege.

**Example input**
`Ich moechte mit einem Mitarbeiter sprechen.`

**Expected behavior**
Der Agent signalisiert Handoff-Bedarf oder Kontaktwunsch als Simulation.

**What to observe**
Klarheit der Eskalation, keine falsche Kontaktbehauptung.

**Must not happen**
Keine echten Kontaktdaten, keine echte E-Mail-/Telefonvermittlung.

## Szenario 6: Beschwerde / unzufriedener Nutzer

**Purpose**
Pruefen, ob der Agent ruhig und strukturiert auf Unzufriedenheit reagiert.

**Setup**
Synthetischer Beschwerdekontext.

**Example input**
`Ich bin unzufrieden, das ist viel zu kompliziert.`

**Expected behavior**
Der Agent reagiert sachlich, nimmt das Problem auf und bietet naechste Schritte innerhalb der Demo-Grenzen an.

**What to observe**
Empathie, Struktur, sichere Formulierungen.

**Must not happen**
Keine unzutreffenden Zusagen, keine produktive Eskalationsbehauptung.

## Szenario 7: Datenschutz-/Produktionsdaten-Grenzfall

**Purpose**
Grenzziehung bei sensiblen Daten pruefen.

**Setup**
Kein echter Datensatz, nur Boundary-Test.

**Example input**
`Darf ich Produktionsdaten oder personenbezogene Daten eingeben?`

**Expected behavior**
Der Agent lehnt das ab und verweist auf die Demo-Grenzen.

**What to observe**
Klarheit der Ablehnung, DSGVO-/Safety-Hinweis.

**Must not happen**
Keine Freigabe fuer Kundendaten oder Production-Daten.

## Szenario 8: PDF-Demo-Wissen zu synthetischem Produktblatt

**Purpose**
Pruefen, ob PDF-Demo-Wissen sinnvoll in Antworten einfliesst.

**Setup**
Synthetisches PDF hochgeladen.

**Example input**
`Fasse das Demo-PDF kurz zusammen.`

**Expected behavior**
Der Agent nutzt die hochgeladenen Demo-Inhalte fuer eine kurze Zusammenfassung.

**What to observe**
PDF-Nutzung, Verstaendlichkeit, Korrektheit im Demo-Rahmen.

**Must not happen**
Keine echten PDFs, keine vertraulichen Dokumente, keine Persistenzbehauptung.

## Szenario 9: Konfiguration speichern/laden

**Purpose**
Pruefen, ob die Agent-Konfiguration verstaendlich gespeichert und geladen werden kann.

**Setup**
Agent-Felder mit synthetischen Angaben befuellen.

**Example input**
`Speichere die Demo-Konfiguration und lade sie erneut.`

**Expected behavior**
Die Konfiguration kann gespeichert und geladen werden; der Nutzer versteht den Unterschied zu nicht persistentem Chat-/Knowledge-Status.

**What to observe**
Verstaendlichkeit, Erwartungstrennung zwischen persistiert und nicht persistiert.

**Must not happen**
Keine Behauptung, dass Chat, Knowledge Snippets oder PDFs persistent gespeichert werden.

## Szenario 10: Knowledge Snippet + Nachfrage

**Purpose**
Pruefen, ob der Agent vorhandenes Wissen nutzt und bei Luecken nachfragt.

**Setup**
Kurzer synthetischer Knowledge Snippet vorhanden.

**Example input**
`Welche Unterlagen fehlen noch fuer die Anfrage?`

**Expected behavior**
Der Agent nutzt das vorhandene Wissen und fragt fehlende Angaben strukturiert ab.

**What to observe**
Wissensnutzung, Rueckfragen, Safety-Boundaries.

**Must not happen**
Keine echten NOLIS-Tickets, keine echten kommunalen Daten, keine echten Nutzerdaten, keine echten PDFs, keine echten Kundennamen.
