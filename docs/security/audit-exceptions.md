# Audit Exceptions

## postcss via next

Date: 2026-06-11  
Expires: 2026-06-25  
Owner: <TODO: Verantwortliche Person eintragen>  
Status: temporary exception

Finding:
- Package: postcss
- Affected range: <8.5.10
- Patched version: 8.5.10
- Severity: moderate
- Dependency path: next@16.2.6 -> postcss@8.4.31
- Audit command: npm audit --omit=dev

Reason:
- The vulnerable package is nested under next.
- A safe Next patch update was tested and did not resolve the nested postcss version.
- npm overrides were tested but did not produce an acceptable clean dependency tree because npm ls postcss became invalid or audit stayed red.
- npm audit fix --force proposes an unsafe Next downgrade and is rejected.

Temporary decision:
- This moderate finding is accepted temporarily for the dashboard UX/setup-wizard deploy.
- High and critical findings still block deployment.
- The audit report remains visible.
- This exception expires on 2026-06-25 or earlier if a stable Next release fixes the nested postcss dependency.

Mitigation:
- No force install.
- No dependency downgrade.
- No invalid npm dependency tree.
- Full build, E2E, API, widget, reporter and smoke test gate must pass.
- Re-check Next stable releases before the exception expires.
- Create follow-up ticket: update Next when nested postcss is fixed.

Follow-up:
- Monitor stable Next releases.
- Re-run:
  - npm view next version
  - npm ls postcss
  - npm audit --omit=dev
- Remove this exception once npm audit --omit=dev is clean.
