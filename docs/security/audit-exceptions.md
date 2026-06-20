# Audit Exceptions

## postcss via next

Date: 2026-06-19

Expires: 2026-07-03

Owner: Platform Owner

Status: temporary exception

Finding:
- Package: postcss
- Affected range: <8.5.10
- Patched version: 8.5.10 or newer
- Severity: moderate
- Dependency path: next@16.2.9 -> postcss@8.4.31
- Audit command: npm audit --omit=dev

Reason:
- The vulnerable package is nested under the stable Next.js release used by the dashboard.
- `next@latest` was checked on 2026-06-19 and resolves to `16.2.9`, which still depends on internal `postcss@8.4.31`.
- A dashboard-local npm override pins `postcss@8.5.15` for the standalone dashboard Docker context and `apps/dashboard` standalone audit is clean.
- The root workspace audit still reports Next's internal dependency path.
- `npm audit fix --force` proposes an unsafe Next downgrade and is rejected.
- Canary, beta, release-candidate or downgrade paths are not used for this demonstrator.

Temporary decision:
- This moderate finding is accepted temporarily for the NOLIS demonstrator hardening cycle.
- High and critical findings still block deployment.
- The audit report remains visible.
- This exception expires on 2026-07-03 or earlier if a stable Next release fixes the nested postcss dependency.

Mitigation:
- No force install.
- No dependency downgrade.
- No invalid npm dependency tree.
- No untrusted Custom-CSS fields in the dashboard.
- Branding remains limited to controlled fields and validated values.
- Full build, E2E, API, widget, reporter and smoke test gate must pass.
- Re-check Next stable releases before the exception expires.
- Create follow-up ticket: update Next when nested postcss is fixed.

Follow-up:
- Monitor stable Next releases.
- Re-run:
  - npm view next version
  - npm view next dependencies.postcss
  - npm ls postcss
  - npm audit --omit=dev
- Remove this exception once npm audit --omit=dev is clean.
