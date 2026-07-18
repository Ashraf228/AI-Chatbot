# Codex Review And Security Diff Scan Policy

## Summary

Diese Policy definiert, wann fuer Codex-Aufgaben ein zusaetzlicher Review-Schritt, ein Security Diff Scan, menschliche Review, CI-Gates und Deploy-Gates verpflichtend sind.

Die Policy ist ein Prozessdokument.

Sie fuehrt keine technische Erzwingung ein und aendert:

- keine GitHub-Settings
- keine Workflow-Dateien
- keine Runtime
- keine Datenbank- oder Production-Aktionen

Security Diff Scan ist ein ergaenzendes Review-Gate. Er ersetzt weder Pflichtchecks noch CI, Main-CI-Gates, Docker-Gates, Deploy-Gates, Human Approval oder Rollback-Planung.

## Review Classes

- `DOKU_ONLY`
- `PROCESS_TOOLING`
- `CI_WORKFLOW_ONLY`
- `PURE_API_BOUNDARY`
- `API_RUNTIME_UNWIRED`
- `API_RUNTIME_WIRED`
- `PUBLIC_WIDGET`
- `AUTH_RBAC`
- `TENANT_ISOLATION`
- `WEBHOOK_DELIVERY`
- `DELIVERY_EXECUTION`
- `DB_READ_ONLY_AUDIT`
- `MIGRATION`
- `CLEANUP_BACKFILL`
- `PRODUCTION_CONFIG`
- `DEPLOY_ONLY`

## Required Review Matrix

| Change Class | Codex Review | Security Diff Scan | Human Review | CI Required | Deploy Gate | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `DOKU_ONLY` | optional | optional bei Risikoindikatoren | optional | ja | nein | kein Security Diff Scan als Standardpflicht, solange keine Workflow-, Secrets-, Auth- oder Runtime-Risiken beruehrt werden |
| `PROCESS_TOOLING` | empfohlen | verpflichtend bei Scripts, Gates, Secrets-Scans oder Prozess-Automation | optional | ja | nein | Stop bei Secret-Leaks, riskanten Shell-Pfaden oder undeutlichem Scope |
| `CI_WORKFLOW_ONLY` | verpflichtend | verpflichtend | empfohlen | ja | nein | Stop bei `pull_request_target`, `id-token: write`, `deployments`/`environments` ohne dokumentierte Freigabe |
| `PURE_API_BOUNDARY` | empfohlen | verpflichtend bei Auth-, DB-, Public-Output-, Tenant- oder Webhook-Bezug | ja | bei live deploytem Runtime-Code ja | pure Boundary ohne Wiring kann lokal ohne Deploy enden; bei spaeterem Deploy gelten Runtime-Gates |
| `API_RUNTIME_UNWIRED` | empfohlen | empfohlen, verpflichtend bei Auth-, DB-, Public-Output-, Tenant- oder Webhook-Bezug | empfohlen | ja | ja, falls live deployed wird | Main-CI-/Docker-Gate bleiben separat |
| `API_RUNTIME_WIRED` | verpflichtend | verpflichtend | empfohlen | ja | verpflichtend | Rollback, Healthcheck und exakte Gate-Evidenz erforderlich |
| `PUBLIC_WIDGET` | verpflichtend | verpflichtend | empfohlen | ja | verpflichtend | Public Response Shape, Leak- und Secret-Pruefungen sind Pflicht |
| `AUTH_RBAC` | verpflichtend | verpflichtend | verpflichtend | ja | je nach Aenderung | Stop bei unklarer AuthZ-Matrix oder fehlender serverseitiger Scope-Pruefung |
| `TENANT_ISOLATION` | verpflichtend | verpflichtend | verpflichtend | ja | je nach Aenderung | Isolation-Regressionen und Resource-Scoping muessen explizit geprueft werden |
| `WEBHOOK_DELIVERY` | verpflichtend | verpflichtend | empfohlen | ja | je nach Aenderung | HMAC, Replay-Schutz, Secret-Nutzung und Logging-Hygiene sind Pflichtfokus |
| `DELIVERY_EXECUTION` | verpflichtend | verpflichtend | empfohlen | ja | je nach Aenderung | Side Effects, Retries, Idempotency und Failure-Pfade muessen adressiert werden |
| `DB_READ_ONLY_AUDIT` | verpflichtend | verpflichtend | Human Approval verpflichtend | ja | nein | keine DB-Handlung, kein SQL und keine Reports mit Daten ohne explizite Freigabe |
| `MIGRATION` | verpflichtend | verpflichtend | Human Approval verpflichtend | ja | je nach Rollout | Rollback-, Backup- und Staging-/Dry-Run-Nachweis Pflicht |
| `CLEANUP_BACKFILL` | verpflichtend | verpflichtend | Human Approval verpflichtend | ja | je nach Rollout | Dry-run, staged execution, Backup und Runbook Pflicht |
| `PRODUCTION_CONFIG` | verpflichtend | verpflichtend | Human Approval verpflichtend | ja | je nach Aenderung | Secrets-/Config-Diff-Pruefung und Rollback muessen dokumentiert sein |
| `DEPLOY_ONLY` | optional vorab, empfohlen zur Evidenzpruefung | optional, wenn kein Scope-Drift | empfohlen | ja | verpflichtend | Deploy-Gate, Healthcheck, Smoke und Rollback bleiben Pflicht |

## Security Diff Scan Scope

Security Diff Scan muss mindestens auf folgende Risikofelder fokussieren:

- authentication
- authorization
- tenant isolation
- public widget response leaks
- DB- und SQL-surfaces
- secrets
- webhooks, HMAC und replay protection
- filesystem access
- network calls
- unsafe logging
- PII exposure
- feature flags
- Production config
- migrations
- cleanup, backfill und enforcement
- report- und query-result outputs
- workflow permissions
- GitHub environments
- OIDC und cloud credentials
- `pull_request_target`

Ein verpflichtender Scan ist insbesondere fuer Runtime-, Auth-, Tenant-, Widget-, Webhook-, Delivery-, Workflow-, Migration-, Cleanup- und Production-Config-Aenderungen vorgesehen.

## Standard Security Diff Scan Prompt

```text
Use security-diff-scan to review changes from origin/main to HEAD for security regressions.
Focus on authentication, authorization, tenant isolation, public widget leaks, DB/SQL surfaces, secrets, webhooks, filesystem/network access, unsafe logging, PII exposure, feature flags, Production config, migrations, cleanup/backfill/enforcement, report/query-result outputs, workflow permissions, GitHub environments, OIDC/cloud credentials, and pull_request_target usage.
Do not modify the checkout.
Return prioritized findings only.
Classify findings as blocker, high, medium, low, or informational.
If no findings, state explicitly that no findings were found.
```

## Mandatory Stop Criteria

Sofort stoppen bei:

- echten Secrets
- ungeplanter DB- oder SQL-Oberflaeche
- Public-Widget-Leak
- unklarer Auth-, RBAC- oder Tenant-Isolation
- ungepruefter Production Config
- Migration ohne Rollback
- Cleanup oder Backfill ohne Approval
- Reports mit Daten
- Query Results im Repo
- fehlender Human Approval bei `DB_READ_ONLY_AUDIT`, `MIGRATION`, `CLEANUP_BACKFILL` oder `PRODUCTION_CONFIG`
- `pull_request_target` in Workflows
- Secrets-Nutzung in Workflows ohne dokumentierte Freigabe
- `id-token: write` ohne dokumentierte Freigabe
- Deployments oder Environments ohne dokumentierte Freigabe

## Integration Into Existing Gates

- PR-Review-/Merge-Prompts sollen zuerst die Change Class bestimmen.
- Danach wird entschieden, ob Security Diff Scan optional, empfohlen oder verpflichtend ist.
- Runtime-Post-Merge-Gates bleiben separat.
- Deploy-Gates bleiben separat.
- `DOKU_ONLY` benoetigt standardmaessig keinen Security Diff Scan, ausser Risikoindikatoren wie Workflow-, Secret-, Auth- oder Config-Bezug liegen vor.
- Runtime-, Auth-, DB-, Widget-, Webhook-, Delivery- und Workflow-PRs benoetigen Security Diff Scan.
- `CI_WORKFLOW_ONLY` benoetigt zusaetzlich einen Workflow-Safety-Scan.
- `DB_READ_ONLY_AUDIT` benoetigt Human Approval vor jeder DB-Handlung.
- Security Diff Scan ist ein Review-Gate und kein Ersatz fuer Tests, CI oder Deploy-Evidenz.

## Output Format

Das gewuenschte Ausgabeformat fuer Codex Review oder Security Diff Scan ist:

1. Summary
2. Findings
3. Blockers
4. Required Follow-ups
5. Scope Confirmation
6. Security Status
7. Decision

Findings sollen priorisiert als `blocker`, `high`, `medium`, `low` oder `informational` klassifiziert werden.

## Relationship To Current Process

- `scripts/ops/codex-preflight.sh` bleibt Pflicht-Preflight.
- `scripts/ops/codex-sensitive-scan.sh` bleibt bestaender lokaler Sensitive-Scan.
- `scripts/ops/codex-main-ci-gate.sh` bleibt der Main-CI-Nachweis fuer exakte Squash- oder Merge-Commits.
- der Docker-Fallback-Workflow bleibt separater Build-Gate-Fallback und kein Review-Ersatz.
- Security Diff Scan ist ein zusaetzliches Review-Gate vor Merge oder Freigabe.
- es gibt keinen automatischen Deploy.

## Non-goals

Diese Policy ist bewusst kein Implementierungsauftrag.

Nicht Bestandteil:

- keine Implementierung
- keine GitHub-Settings-Aenderung
- keine Workflow-Aenderung
- kein Deploy
- kein DB- oder SQL-Auftrag
- keine technische Erzwingung eines Review-Tools, solange das Tool nicht verfuegbar ist
- keine Aenderung bestehender CI-Pflichten

## Recommended Follow-up

Empfohlener naechster Schritt:

- `P0-Review-1B Security Diff Scan Prompt Template Hardening`

Scope:

- Prompt-Template aktualisieren
- keine Runtime-Aenderung
- keine Workflow-Aenderung
- keine GitHub-Settings

Sinnvolle Alternative:

- `P0-Docker-1F Docker fallback workflow action version hardening`
