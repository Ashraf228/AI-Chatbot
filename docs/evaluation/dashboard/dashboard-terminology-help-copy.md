# Dashboard Terminology and Help Copy

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `38dbe9490edf9b18061eaf5102cc40498ce13042`
- Scope: unify dashboard terminology, help copy, caveats, and safety wording
- Goal was language clarity only, not a new feature or permission change
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No customer data was used
- No credentials or passwords were created or changed
- Guided customer demo remains blocked
- Self-service customer demo remains blocked
- Real pilot remains blocked

## Previous Problem

- the main flow still mixed technical and user-facing wording
- `Setup`, `Go-Live`, `Boundary`, `Agent`, `Knowledge`, `Production`, and `Public Widget` were not always explained consistently
- some core areas still used English or system-internal language where shorter German wording was clearer
- safety copy was present, but not always phrased in the same way across status bar, setup, review, and evaluation views
- internal technical language and normal operator language were not fully separated

## Terminology Rules

- visible role in the main flow: `KI-Mitarbeiter`
- primary user flow: `Einrichtung`
- user-facing content sources: `Wissen`
- main setup test path: `Interner Test`
- final setup step: `Review & Livegang`
- advanced/internal debug surface: `Technische Diagnose`
- external surface wording: `oeffentliches Chatfenster`
- technical term `Runtime-Pilot` remains allowed only as secondary wording inside diagnosis/test explanation
- technical term `Public Widget` remains allowed only where the technical boundary itself is explained

## Updated UI Areas

- `CustomerStatusBar`
  - `Setup fortsetzen` became `Einrichtung fortsetzen`
  - `Production` and `Public Widget` badges now use clearer German wording
  - next-step copy now explains that the setup flow remains the binding review source
- `CustomerNavGroups` / `dashboard-config`
  - setup group description now reads as a binding setup area, not `Source of truth`
  - internal test wording now refers to the chat window path instead of generic technical setup language
- `SetupWizardSidebar`
  - `Rolle & Boundary` became `Rolle & Grenzen`
  - live/production wording now uses `Produktivbetrieb` and `Livegang`
- `LaunchStep` / `GoLivePanel`
  - review step wording now stays in `Einrichtung` / `Livegang` language
  - `Advanced Diagnostics` became `Technische Diagnose`
  - review area no longer reads like a latent activation control
- `KnowledgeStep` / `KnowledgeSourceCard`
  - visible copy now explains the user-facing role as `KI-Mitarbeiter`
  - persistent knowledge wording now refers to the existing knowledge path more clearly
- `SetupReadinessChecklist`
  - `Testfrage gesendet` became `Interner Test durchgefuehrt`
  - `Go-Live` became `Review & Livegang`
- `SiteForm`
  - create flow now hands off to `KI-Mitarbeiter-Einrichtung`
  - `Legacy Bot-Typ` became `Legacy-KI-Profil`
- `EvaluationWorkspace`
  - viewer-facing copy now uses `Evaluationsbereich`
  - read-only caveat now says `gefuehrt und nur zum Lesen` instead of `guided/evaluation only`

## Help Copy Improvements

- each main setup area now answers the practical operator question more directly:
  - what is configured here
  - what remains blocked
  - what the next step is
- the internal test area now explains:
  - that it is an internal admin/operator path
  - that no deploy, no public chat window, and no production activation happen here
  - that the transcript stays local
- the review area now explains:
  - this is a review gate
  - the step does not activate anything
  - technical diagnosis is separate from the normal operator flow
- the evaluation workspace now states more clearly:
  - external demo access is read-only
  - no setup/configuration is allowed
  - no production or real NOLIS access is implied

## Safety Copy Preserved

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no passwords
- no real tickets, e-mails, or webhooks
- no provider calls
- no enterprise-ready or production-ready claim
- guided customer demo remains blocked
- self-service customer demo remains blocked
- real pilot remains blocked

## Advanced Diagnostics Language Boundary

- advanced/internal cards keep technical naming only where the technical surface itself is the subject
- the normal setup, knowledge, review, status, and evaluation flow no longer depends on technical labels such as `Source of truth` or `Advanced Diagnostics`
- `Runtime-Pilot` remains referenced only as secondary technical context inside the internal test explanation

## Tests Added

- updated wording assertions in:
  - `apps/dashboard/test/CustomerStatusBar.test.tsx`
  - `apps/dashboard/test/CustomerNavGroups.test.tsx`
  - `apps/dashboard/test/CustomerSetupWizard.test.tsx`
  - `apps/dashboard/test/EvaluationWorkspace.test.tsx`
  - `apps/dashboard/test/SiteForm.test.tsx`
  - `apps/dashboard/test/DashboardRoleAccess.test.ts`
  - `apps/dashboard/test/accessibility.test.tsx`

## Remaining Follow-up Fixes

- test-result wording can still become clearer in the internal test transcript and outcome summaries
- knowledge readiness and source-state wording can still be sharpened further in dedicated follow-up work
- technical diagnosis cards still use internal technical names intentionally and were not normalized into business copy in this task

## Safety Boundaries

- no deploy
- no public widget activation
- no production activation
- no enterprise approval
- no customer data
- no production data
- no production secrets
- no credentials
- no password creation
- no password change
- no DB migration
- no package or lockfile changes
- no provider calls
- no query runner
- no screenshots
- no recordings

## Next Step

- Recommended next task: `DASHBOARD-P1-TESTCHAT-RESULT-CLARITY-1`
- Optional later follow-up: `DASHBOARD-P1-KNOWLEDGE-SOURCES-AND-STATUS-1`
