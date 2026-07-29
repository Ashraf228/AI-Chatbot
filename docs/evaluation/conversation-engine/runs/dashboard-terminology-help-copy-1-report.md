# Dashboard Terminology Help Copy 1 Report

## Summary

- run_id: `dashboard-terminology-help-copy-1`
- run_type: `dashboard_p1_terminology_help_copy`
- terminology improved: yes
- help copy improved: yes
- safety copy preserved: yes
- advanced diagnostics boundary preserved: yes
- dashboard code changed: yes
- API code changed: no
- guided customer demo: still blocked
- self-service customer demo: blocked
- real pilot: blocked

## UI Copy Changes

- unified the visible main-flow role wording around `KI-Mitarbeiter`
- shifted primary user flow wording toward `Einrichtung`, `Interner Test`, and `Review & Livegang`
- replaced remaining English/system-internal labels in operator-facing surfaces where a clear German term was available
- kept technical wording restricted to diagnosis-specific areas

## Terminology Rules

- `KI-Mitarbeiter` in the visible role flow
- `Einrichtung` for the primary setup path
- `Wissen` for user-facing knowledge/source wording
- `Interner Test` for the main test path
- `Review & Livegang` for the final setup step
- `Technische Diagnose` for advanced technical cards
- `oeffentliches Chatfenster` where the external boundary is described

## Help Copy Improvements

- status bar now explains the current next step and blocked activation state more directly
- setup sidebar now frames role limits as `Grenzen`
- review step now reads as an explicit review gate, not a latent activation action
- internal test now explains local transcript behavior and blocked side effects more clearly
- create form now hands off to the `KI-Mitarbeiter-Einrichtung` instead of vaguely to `Setup`
- viewer/evaluation copy now states the read-only limit in plain language

## Safety Copy

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no passwords
- no real tickets, e-mails, or webhooks
- no provider calls
- no enterprise or production-ready claim

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy
- public widget activation
- production activation
- customer data usage

## Regression Coverage

- updated dashboard wording tests around status bar, navigation, setup wizard, evaluation workspace, site create flow, role access, and accessibility announcement text
- preserved the technical diagnostics split for internal-only areas

## Safety Confirmation

- no API changes
- no runtime changes
- no widget changes
- no DB reads or writes
- no migration
- no package or lockfile changes
- no screenshots or recordings
- no credentials or passwords

## Recommended Next Step

- `DASHBOARD-P1-TESTCHAT-RESULT-CLARITY-1`
