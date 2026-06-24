# Tenant and Viewer Security Gate

Dieses Gate schuetzt die harten Sicherheitsgrenzen der Plattform:

- Tenant-Isolation
- Site-Isolation
- Viewer-Evaluation-Isolation
- Rollen-Grenzen zwischen `admin`, `operator`, `customer` und `viewer`
- Handoff-/Webhook- und Evaluation-Scope
- migrationsseitige Constraints fuer sicherheitsrelevante IDs

## Lokale Befehle

```bash
npm run security:check-authorization-matrix
npm run test:security-boundaries
npm run test:security:postgres
```

`test:security:postgres` fuehrt lokal nur dann DB-Pruefungen aus, wenn beide Variablen gesetzt sind:

```bash
SECURITY_POSTGRES_DATABASE_URL=postgres://... SECURITY_POSTGRES_EXECUTE=1 npm run test:security:postgres
```

Ohne diese Variablen wird der lokale PostgreSQL-Teil bewusst uebersprungen. Die GitHub Actions enthalten dafuer einen separaten Job mit leerer isolierter pgvector-PostgreSQL-Datenbank.

## CI-Gates

Die GitHub Actions fuehren aus:

- `security:check-authorization-matrix` im Source Gate
- `test:security-boundaries` im Source Gate
- `test:security:postgres` im separaten Job `Security PostgreSQL isolation`

Der PostgreSQL-Job spielt alle Migrationen in eine leere isolierte Datenbank ein und prueft die sicherheitsrelevanten Constraints aus den Evaluation-, Handoff- und Webhook-Migrationen.

## Blockierende Regressionen

Folgende Aenderungen muessen blockieren, bis Matrix, Tests und Dokumentation bewusst angepasst wurden:

- neue Dashboard- oder Backend-Route ohne Matrix-Eintrag
- Viewer-Zugriff ausserhalb der exakten Allowlist
- Prefix-Allowlist fuer Viewer-Routen
- Dashboard-Header werden ohne internes Dashboard-Token akzeptiert
- Tenant- oder Site-Ressourcen werden ohne serverseitigen Scope gelesen, geaendert, geloescht oder exportiert
- Evaluation-Zugriff ohne Revalidierung des Viewer-Tenant-Users
- Retrieval-Rueckfall auf ungescopte Daten bei null Treffern
- Confirm-/Cancel-/Handoff-Routen nehmen Viewer-gelieferte fremde IDs oder Signaturen als Autoritaet
- Secrets, Reporter-E-Mail oder interne Payloads gelangen in Browser-DTOs, Logs oder Modellkontext

## Erwartete Artefakte

`npm run test:security-boundaries` schreibt technische Reports nach:

- `artifacts/security/security-boundaries.json`
- `artifacts/security/security-boundaries.md`

Diese Artefakte sind nicht fuer Git vorgesehen und duerfen keine Secrets oder personenbezogenen Daten enthalten.

## Grenzen

Dieses Gate ist ein technischer Regressionsschutz. Es ersetzt keine manuelle Staging-Pruefung, keine echte Browser-Rollenpruefung und keine externe Sicherheitsabnahme.
