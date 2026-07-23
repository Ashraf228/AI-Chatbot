# Audit Exceptions

## postcss via next@16.2.11 dashboard production dependency path

Date: 2026-07-23

Reviewed: 2026-07-23

Expires: 2026-08-06

Owner: security_owner

owner_role: security_owner

Status: temporary_contextual_exception

Finding:
- Package: postcss
- Advisories:
  - GHSA-qx2v-qp2m-jg93
  - GHSA-6g55-p6wh-862q
- Severity: high
- Context: Dashboard / Next.js production dependency path
- Dependency path: node_modules/next/node_modules/postcss
- Parent: next@16.2.11
- Affected version: 8.4.31
- Safe target: stable Next release that no longer pins vulnerable PostCSS

Reason:
- No stable Next release greater than 16.2.11 is currently available with fixed internal PostCSS.
- Canary, alpha, beta, release-candidate and downgrade paths are not accepted here.
- The override path was tested and was ineffective for the exact Next-internal dependency path.
- The dashboard standalone production audit is clean; the remaining production-context blocker is the root workspace view of the exact Next-internal dependency path.
- No direct application-level postcss processing of user-supplied CSS was identified in this review.
- No approved custom-CSS, tenant-CSS or branding-CSS pipeline was identified in this review.

Residual risk:
- Low under current deployment assumptions.
- Not none.
- Revalidation is required if CSS, theme, branding or custom-CSS capabilities expand.

Scope limitations:
- exact Next-internal PostCSS dependency path only
- no customer data expansion
- no production data approval
- no DB_READ_ONLY_AUDIT
- no broad enterprise rollout
- no deploy approval
- no blanket postcss waiver
- no blanket high-severity waiver

Impact analysis:
- The current finding is limited to the Next.js internal PostCSS dependency path.
- No direct application-level postcss processing of untrusted CSS was identified in this review.
- No custom CSS, tenant CSS or user-supplied CSS pipeline is approved in the current deployment.
- One widget bootstrap path concatenates locally bundled CSS assets into a style tag; this review did not identify a user-supplied CSS input path there.
- Risk is accepted as low under current deployment assumptions, not as none.
- Revalidation is required if any CSS, theme, branding or custom-CSS feature is added.

Temporary decision:
- This is a temporary contextual risk acceptance, not a fix.
- This is not a blanket high-severity waiver.
- This is not a runtime approval.
- This is not enterprise-readiness approval.
- High and critical findings remain blocking unless they match this exact accepted finding.
- Critical findings are never accepted.

Revalidation triggers:
- new stable Next release greater than 16.2.11
- production-context audit behavior changes
- dashboard dependency update
- dashboard CSS, theme, branding or custom-CSS feature changes
- public widget styling pipeline changes
- before active enterprise outreach
- before real-customer pilot

Follow-up:
- Monitor stable Next releases.
- Remove this exception immediately after a stable Next upgrade removes the exact vulnerable path.
- Re-run:
  - npm view next version
  - npm view next@16 version --json
  - npm ls next --all
  - npm ls postcss --all
  - npm run security:audit:production-contexts
