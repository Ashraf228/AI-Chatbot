# Wissenskern: Suche, Antworten und Website-Indexierung

## Umfang und Aktivierung

Dieser Code ergänzt den bestehenden Chatpfad um einen gezielt gewählten Wissensmodus. Er aktiviert keine Site, erstellt keine Providerfreigaben und wechselt kein Modell. Basis: `a5464e7d694e060cee41a7e50693d6847ea12d3b`; keine Schemaänderung.

Der kanonische AssistantProfileResolver muss ein **gespeichertes** Profil (`legacySource=assistantProfile`, gültige `profileVersion`) liefern:

- `profileKey=knowledge-assistant`, oder `universal-assistant` mit `answerStyle=knowledge_first`;
- `conversationEngine.enabled=true`, `enabledTasks` enthält `answer_questions`, `knowledgeMode` ist nicht `disabled`.

Die vorhandene Priorität Modul `assistant-profile` → Modul `assistant` → Site-Konfiguration bleibt erhalten. Legacy-/Defaultprofile wählen diesen Pfad nicht automatisch. Die bisherige Sales-/Support-Runtime bleibt für andere Profile erhalten. Die Profilwahl verändert das öffentliche Antwortverhalten und muss für die konkret freigegebene Pilot-Site bewusst gespeichert und abgenommen werden.

Die Conversation Engine klassifiziert die Frage und liefert ihre Sperrentscheidung. Ihr reiner `preview`-Entscheidungsdienst wird wiederverwendet; es werden weder Agenten-Orchestrator noch Tools, Leads, Tickets oder Zustellungen ausgeführt. Das ist keine neue universelle KI-Modellversion. Antworten verwenden weiterhin das konfigurierte und separat freigegebene LLM.

## Auswahl im Dashboard

Für universelle Assistenten im Einrichtungsschritt **KI-Mitarbeiter → Arbeitsweise → Wissensassistent mit Quellen** wählen und speichern. Die Auswahl speichert `answerStyle=knowledge_first`, `knowledgeMode=strict` und die erforderliche Aufgabe `answer_questions` im kanonischen Assistant-Profil. Bereits gespeicherte Wissensprofile bleiben auch nach erneutem Laden und Speichern der Gesprächslogik erhalten. Andere Antwortstile werden ohne ausdrücklichen Wechsel beibehalten.

Im Wissensmodus zeigt die Gesprächslogik den Wissensablauf. Weitere Aufgaben und Pflichtinformationen bleiben gespeichert, sind aber während dieser Arbeitsweise nicht bearbeitbar und werden vom Wissenspfad nicht ausgeführt. Der Wechsel zurück zu **Konfigurierte Aufgaben und Übergaben** macht diese Einstellungen wieder verfügbar. Branchenvorlagen bleiben auf ihrem bisherigen Konfigurationspfad.

Das Speichern des Profils erstellt keine Providerfreigaben. Frage-Embedding und Antwortgenerierung benötigen jeweils einen eigenen gültigen Grant für Tenant, Site, Umgebung und tatsächlich konfiguriertes Modell. Die internen Verwaltungswege sind unter [Query-Grants](site-runtime-grant-operator-transport.md) und [LLM-Grants](site-runtime-llm-generation-grant.md) dokumentiert. Ohne diese Freigaben bleibt die vorhandene Schutzablehnung bestehen.

## Datenfluss und Freigaben

| Schritt | Vertrag |
|---|---|
| PDF/Text/FAQ | bestehende Ingestion-/Reindexpfade und deren Grants |
| Website abrufen | neue explizite Admin-/Operatoraktion, öffentliche HTTP(S)-Inhalte derselben Origin |
| Website einbetten | frische gespeicherte Source-/Source-Type-Freigabe je Transport; Purpose und einziger Usage-Kontext `website_ingest_runtime_indexing`, Dimension 1536 |
| Frage einbetten | bestehender `site_runtime/query_embedding`-Vertrag |
| Antwort erzeugen | bestehender `site_runtime/llm_generation`-Vertrag mit Usage-Erfassung |

Tenant, Site, Quelle, Source-Typ, Aktivität, Umgebung, Provider und Modell werden serverseitig gebunden. Mock-Validierungs-, Query-, LLM- und allgemeine Knowledge-Ingestion-Grants ersetzen die Website-Freigabe nicht. Keine automatischen Grants, kein Lockern von Endpoint-, Redirect-, Logging- oder Retryregeln. Die fachlichen Terms eines echten Grants müssen vom Betreiber bestätigt sein; dieses Dokument enthält keine erfundenen Zustimmungen.

## Suche und Antwort

1. Bei erkannten Rückfragen werden bis zu zwei vorherige Nutzerfragen in die Suchanfrage übernommen. Ein Themenwechsel bleibt eine eigenständige Anfrage. Diese begrenzte Heuristik ersetzt keine universelle sprachliche Auflösung jedes Bezugs.
2. `searchKnowledge` kombiniert semantische Treffer mit PostgreSQL-Volltexttreffern per Reciprocal Rank Fusion. Semantischer Startschwellwert: Cosinus 0,30; lexikalische Kandidaten benötigen positive Ähnlichkeit. Diese Startwerte sind **noch nicht am Pilotkorpus kalibriert**.
3. Nur aktive, `ready`-Quellen mit passender Tenant-/Site-Bindung auf Chunk, Dokument und Quelle werden berücksichtigt. Verwaiste Dokumente werden ausgeschlossen. Evaluationsmodus verlangt weiterhin synthetische Demoquellen.
4. Höchstens acht unterschiedliche Passagen und 14.000 Zeichen bilden den Kontext. Der Prompt verlangt konkrete, quellengebundene Antworten, nennt Widersprüche/fehlende Informationen und behandelt Anweisungen in Dokumenten als Daten.
5. Antworten benötigen gültige `[Qn]`-Belege. Unbekannte, fehlende oder leere Belege führen zur ausdrücklichen Nichtantwort. Nicht benutzte Quellen werden entfernt und Belege passend neu nummeriert.
6. Auch bei Streaming wird generierter Text erst nach dieser strukturellen Prüfung veröffentlicht. Der bestehende öffentliche Event-/Responsevertrag bleibt erhalten, aber die erste sichtbare Antwort kommt im Wissensmodus später als beim direkten Tokenstream.

**Grenzen:** Gültige Belegnummern beweisen keine semantische Richtigkeit. Prompt-Injection-Abwehr durch den Prompt ist keine mathematische Garantie. Der Datenbestand kann fehlen, falsch oder veraltet sein. Die lexikalische Suche berechnet Volltextwerte zur Anfragezeit; große Unternehmensbestände benötigen eine gemessene Skalierungs-/Indexentscheidung. Keine OCR, Tabellenrekonstruktion, Reranking mit zweitem Modell oder neue Kostenobergrenze enthalten.

## Website-Aktion

`POST /api/ingest/sources/{sourceId}/crawl-index` (Dashboard) → `POST /admin/ingest/sources/{sourceId}/crawl-index` (API). Body: ausschließlich optional `maxPages`, ganzzahlig 1–20. Dashboard verwendet 20. Rollen `admin`/`operator`, aufrufende Session und API-Site-Scope bleiben erforderlich. BFF-Mutationen verlangen die konfigurierte `DASHBOARD_PUBLIC_URL`, passenden Origin und `Sec-Fetch-Site: same-origin`.

Eine URL-Quelle muss vorhanden und aktiv sein. Der bisherige URL-Import allein stellt noch keinen Live-Suchindex her. Im Wissensschritt startet **„Website durchsuchen & indexieren“** die Verarbeitung. Customer-/Viewerzugänge erhalten keine neue Berechtigung.

Begrenzungen:

- gleiche Origin einschließlich Schema/Port; kein Wechsel zu `www` oder einer Subdomain während des Crawls;
- Robots-Regeln vor Seitenabruf, maximal drei Sitemap-Dateien, maximal 200 entdeckte Adressen;
- maximal 20 Seiten, Linktiefe 3, 100.000 Zeichen, 100 Chunks;
- keine Query-URLs, Datei-Downloads, JavaScript-Ausführung, Loginbereiche oder Formulare;
- DNS-Pinning und Sperren für private/lokale Netze bei jedem Ziel; Redirects werden vor Transport erneut geprüft;
- 8 Sekunden je Abruf einschließlich DNS, Redirects und Body; gemeinsames Abbruchbudget der Indexierung 45 Sekunden ab Eintritt in `WebsiteKnowledgeIndexService.index`, einschließlich der ersten Source-/Snapshot-Lesezugriffe; Providertransport 30 Sekunden; Transaktion mit 3 Sekunden Lock- und 10 Sekunden Statementfrist;
- API: zwei Startversuche pro Site/Actor und Minute. Das ist keine kommerzielle Kostenobergrenze.

Die UI-Zahl bedeutet **verarbeitete, innerhalb dieser Regeln entdeckte Seiten**, nicht Vollständigkeit des gesamten Internets oder aller unverbundenen Seiten. Robots-gesperrte Seiten werden ausgeschlossen. Erreicht der Crawl eine Mengen-/Textgrenze, wird die Indexierung vor Provideraufrufen abgelehnt. Umfangreiche oder langsame Websites brauchen einen gesonderten Hintergrundworkflow; dieser Pilot implementiert keinen solchen Jobdienst.

Robots-Pfade werden auf beiden Seiten nach den Prozentkodierungsregeln von RFC 9309 normalisiert: unreservierte ASCII-Oktette dekodieren, reservierte Escapes erhalten, UTF-8 kodieren; keine doppelte Dekodierung. `*` und ein abschließendes `$` werden ohne dynamische Regex mit linearer Literalsuche ausgewertet. Ein Gesamtbudget von zwei Millionen Arbeitseinheiten pro URL begrenzt zusätzlich große Regelsätze; Überschreitung oder ungültige Prozentkodierung brechen den Crawl ab, statt Seiten freizugeben. Längste Regel und Allow-Vorrang bei Gleichstand bleiben erhalten.

Jede produktive Namensauflösung besitzt einen eigenen `dns.promises.Resolver` für A/AAAA-Abfragen. Abbruch und Zeitlimit rufen dessen `cancel()` auf; alle gelieferten Adressen müssen weiterhin öffentlich sein, bevor eine davon für HTTP gepinnt wird. Andere laufende Crawls werden nicht mit abgebrochen. Anders als das frühere `dns.lookup` verwendet dies direkte DNS-Auflösung statt OS-/`/etc/hosts`-Zuordnungen. Es werden keine DNS-Server oder Netzwerkregeln geändert. Injizierte Testresolver dürfen verspätet antworten; ihre Ergebnisse bzw. Fehler werden beobachtet, dürfen nach Abbruch aber keinen HTTP-Transport auslösen. Nicht abbrechbare Testresolver sind kein produktiver Resolverpfad.

Technische Referenzen: [RFC 9309, Abschnitt 2.2.2](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.2) und [Node.js Resolver.cancel](https://nodejs.org/api/dns.html#resolvercancel).

Alle Embeddings müssen vor Austausch der Dokumente erfolgreich sein. Danach wird die Quelle mit unveränderter Revision in einer Transaktion gesperrt, ihr alter Dokumentbestand ersetzt und erst dann `ready` gesetzt. Provider-, Crawl-, Konflikt- oder Speicherfehler behalten den vorherigen Snapshot. Browser-/BFF-Abbruch wird weitergereicht; ein bereits abgeschlossener Commit kann durch einen späteren Verbindungsabbruch nicht zurückgenommen werden. Nach einem unklaren HTTP-Ergebnis ist daher Reload maßgeblich.

Die Wartephasen der ersten beiden Lesezugriffe reagieren auch bei noch nicht aufgelöstem Promise auf Abbruch und Frist. Bereits abgebrochene Aufrufe beginnen keinen dieser Reads. Späte Read-Ergebnisse und -Fehler werden beobachtet, starten aber keine weitere Phase; Crawl, Provideraufrufe, Austausch der Dokumente und Ready-Markierung bleiben dann aus. Abbruch- und interne Read-Fehler verlassen die Servicegrenze nur als bestehende generische 502-Meldung; ungültige Quellen bleiben 400, fehlende Revisionen 409. Timer und Read-Abbruchlistener werden entfernt.

Diese Wartebegrenzung ist **keine serverseitige SQL-Cancellation**: Ein bereits gestartetes, ausschließlich lesendes Statement kann im unveränderten Datenbankadapter weiterlaufen. SQL, Pool und Transaktionsablauf wurden dafür nicht geändert. Die 45 Sekunden sind deshalb keine harte Obergrenze für die gesamte HTTP-Anfrage einschließlich vorgelagerter Autorisierung, nachgelagertem Audit oder bereits laufender DB-Statements und Rollback/Cleanup. Die Transaktion wird nicht durch ein Promise-Race vom Aufrufer getrennt; ihre Fehlerbehandlung bleibt abzuwarten. Eine Bestätigung sofort freigegebener DB-Ressourcen oder eines harten Gesamt-Request-Limits wäre durch diesen Fix nicht gedeckt.

Der alte `resync`-Pfad lehnt bereits gecrawlte Quellen ab. Er darf sie weder auf den alten Einzelimport zurücksetzen noch den neuen begrenzten Indexierungsendpunkt umgehen.

## Reproduzierbare Prüfungen

```sh
npm run build:api
node --test apps/api/test/knowledge-core-pipeline.test.cjs apps/api/test/knowledge-core-modules.test.cjs apps/api/test/website-crawl.test.cjs apps/api/test/website-knowledge-index.test.cjs
npx vitest run --config vitest.ui.config.ts apps/dashboard/test/WebsiteKnowledgeCrawl.test.tsx apps/dashboard/test/KnowledgeSourceCard.test.tsx apps/dashboard/test/CustomerSetupWizard.test.tsx
```

Zusätzlich verpflichtend: API-Smoke, alle Typechecks, Dashboard-/Widget-Build, Authorization Matrix, Security Boundaries, Sensitive Scan und Diff-Check. `test:e2e` bezeichnet hier die vorhandene jsdom-UI-Suite, keinen vollständigen Browser/API/DB-Lauf.

Die Wizard- und Pipeline-Regressionen prüfen Speichern, erneutes Laden sowie die Auswahl des normalen und gestreamten Wissenspfads mit simulierten Speicher-/Providerports. Die CI prüft zusätzlich Erstellung, Wiederholung, Konflikte, Widerruf und Audit-Rollback von Query- und LLM-Grants auf einer eigens gestarteten PostgreSQL-16-Testinstanz (`site-runtime-grant-write.postgres16.test.cjs`). Beide Prüfarten ersetzen keinen echten Widget-Pilot mit dem eingesetzten Provider.

Die echte SQL-Prüfung benötigt eine **eigene lokale PostgreSQL-Datenbank mit pgvector**, benannt `knowledge_core_test_<suffix>`. Anwendungskonfiguration `DATABASE_URL` wird dafür nicht verwendet:

```sh
KNOWLEDGE_CORE_POSTGRES_TEST=1 \
KNOWLEDGE_CORE_TEST_DATABASE_URL='<eigene lokale Testdatenbank>' \
node --test apps/api/test/knowledge-core.postgres.test.cjs
```

Die Prüfung nutzt ausschließlich temporäre Tabellen mit echten Vector-/Volltextoperationen und Rollback. Sie ersetzt weder eine Migrationserprobung noch einen Last-/Crash-/Mehrprozessnachweis. Ohne expliziten Opt-in bleibt sie sichtbar übersprungen.

## Pilotabnahme und Rückfall

Vor Deployment: unabhängige Delta-Prüfung, vollständige Pflichtgates und CI/Images auf dem tatsächlichen Releasecommit. Eine lokale Testfreigabe ist keine Betriebsfreigabe.

Vor Live-Wissensverkehr: Profil und alle drei tatsächlich benötigten Grantarten an der konkreten Site bestätigen; aktuelle Dokumente und Website-Seiten inventarisieren; einen normalen und einen gestreamten realen Widgetpfad prüfen. Nicht den simulierten Wizard-Testchat als Beleg verwenden.

Vorgeschlagener Qualitätsumfang: 40 fachlich bewertete Fälle (12 direkte Fakten, 8 Umformulierungen, 6 mehrteilige/Quellen-verbindende Fragen, 6 Rückfragen, 4 unbeantwortbare Fragen, 4 Manipulations-/Widerspruchsfälle). Erwartete Fakten und Quellen müssen aus dem echten Korpus vorab festgelegt werden. Erfassen: richtige Antwort, passende Belege, keine erfundenen Zusagen, angemessene Nichtantwort, Latenz und gemessene Usage. Dies ist noch kein ausgeführter Qualitätsnachweis und keine 100-%-Garantie für beliebige Fragen.

Rollback ohne Schemaänderung: zunächst Pilotverkehr gezielt deaktivieren oder zugehörige Runtime-Grants widerrufen; anschließend Code auf den vorangehenden freigegebenen Release zurücknehmen. Neue `websiteCrawl`-Quellen vor Nutzung des alten Resync-Pfads deaktivieren; alte Einzelimportlogik darf ihren Index nicht überschreiben. Keine Datenlöschung oder Scope-Erweiterung als Rollback. Bekannte ältere Wissens-/Routinglücken kommen beim Code-Revert zurück; daher keinen Revert als weiterhin abgenommenen Wissenspilot ausgeben.

IPv6-Verifikation, historische externe Verbindungs-Beleggrenze, Speicher-/Prozessverluste sowie Kosten-/Budgetentscheidungen bleiben separate Punkte.
