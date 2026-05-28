# Prueffragen fuer Anwalt oder Datenschutzberater

Stand: 2026-05-28

Diese Fragen dienen der strukturierten Pruefung. Sie sind keine Rechtsberatung und enthalten keine abschliessende rechtliche Bewertung.

## AVV

- Ist das Rollenmodell Kunde = Verantwortlicher und Anbieter = Auftragsverarbeiter fuer den konkreten Einsatz zutreffend?
- Gibt es Szenarien mit eigener Verantwortlichkeit oder gemeinsamer Verantwortlichkeit?
- Welche Weisungen des Kunden muessen im AVV konkret beschrieben werden?
- Welche Datenarten und Betroffenengruppen muessen in die AVV-Anlage aufgenommen werden?
- Wie sollen Rueckgabe, Loeschung und Unterstuetzung bei Betroffenenrechten geregelt werden?

## TOMs

- Sind die dokumentierten technischen und organisatorischen Massnahmen ausreichend fuer den vorgesehenen Einsatz?
- Muessen Zugriffskontrolle, Rollenmodell oder Supportzugriff organisatorisch genauer geregelt werden?
- Sind Backup, Offsite-Restore, Monitoring, Alerting und Logrotation fuer den Kundeneinsatz angemessen beschrieben?
- Soll ein regelmaessiger Nachweis fuer Restore-Tests, Backup-Checks und Security-Reviews vereinbart werden?

## Unterauftragsverarbeiter

- Welche Anbieter sind im konkreten Kundenbetrieb tatsaechlich beteiligt?
- Liegen fuer Hosting, Backup, SMTP, KI/API, DNS/Proxy/CDN, Monitoring/Alerting und Git/Repo-Anbieter passende Vertrage oder DPAs vor?
- Welche Anbieter muessen dem Kunden vorab offengelegt oder genehmigt werden?
- Welche Kuendigungs-, Wechsel- und Loeschprozesse gelten je Anbieter?

## Drittlandtransfer

- Welche Anbieter verarbeiten Daten ausserhalb EU/EWR oder koennen Zugriff aus Drittlaendern haben?
- Welche Transfermechanismen sind erforderlich und vorhanden?
- Sind zusaetzliche Risikobewertungen oder technische Schutzmassnahmen erforderlich?
- Wie werden Aenderungen bei Anbietern oder Standorten kommuniziert?

## Speicherfristen

- Welche Speicherfristen sind fuer Leads, Conversations, Messages, Jobs, Logs, Backups, Usage/Billing und Audit Logs angemessen?
- Welche Fristen gelten je Kunde oder Branche?
- Welche gesetzlichen oder vertraglichen Aufbewahrungspflichten sind zu beachten?
- Wann darf `RETENTION_CLEANUP_ENABLED=true` gesetzt werden?
- Wann darf restic `forget`/`prune` fuer Offsite-Snapshots aktiviert werden?

## Kundendatenschutzerklaerung

- Welche Rechtsgrundlage nutzt der Kunde fuer Chat und Lead-Erfassung?
- Welche Informationen muessen in die Datenschutzerklaerung des Kunden aufgenommen werden?
- Muss der Chat als automatisierter digitaler Assistent beschrieben werden?
- Welche Unterauftragsverarbeiter und Empfaenger muessen genannt werden?
- Welche Speicherdauer und Kontaktmoeglichkeiten muessen angegeben werden?

## KI-/Chatbot-Transparenz

- Reicht der aktuelle Hinweis auf automatisierte Anfrageaufnahme aus?
- Sind besondere Transparenzpflichten fuer KI-gestuetzte Antworten zu beachten?
- Wie muss mit potenziell falschen oder unvollstaendigen Antworten umgegangen werden?
- Muss eine menschliche Kontaktmoeglichkeit besonders hervorgehoben werden?

## Incident und Meldeprozess

- Wer ist intern fuer technische und datenschutzrechtliche Vorfallbewertung verantwortlich?
- Welche Fristen und Meldewege gelten bei moeglichen Datenschutzvorfaellen?
- Wie werden betroffene Kunden informiert?
- Welche Log- und Nachweisdaten duerfen gesichert werden, ohne unnoetige Datenkopien zu erzeugen?

## Loeschung und Export

- Welche Identitaets- und Berechtigungspruefung ist vor Export oder Loeschung erforderlich?
- Welche Daten werden bei Site-Delete, Conversation-Delete und Lead-Delete entfernt oder anonymisiert?
- Wie werden Backups behandelt, die bereits geloeschte Daten noch bis Ablauf der Backup-Retention enthalten?
- Wie wird Rueckgabe oder Loeschung bei Vertragsende dokumentiert?

## Kundenspezifische Go-Live-Pruefung

- Ist die Kundendatenschutzerklaerung vor Widget-Einbindung aktualisiert?
- Ist `privacyUrl` korrekt gesetzt und erreichbar?
- Ist `consentRequired` fuer den Kundenfall passend konfiguriert?
- Sind erlaubte Domains korrekt und ohne fremde Domains gepflegt?
- Sind Wissensbasis-Inhalte frei von fremden Kundendaten?
- Sind Lead-Zieladresse, Webhook-Ziele und Zugriffskonten korrekt freigegeben?
