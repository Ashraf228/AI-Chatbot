# Audit Exceptions

No active production-context audit exceptions are currently registered.

## Removed Active Exception: dashboard-next-postcss-2026-07-23

Created: 2026-07-23

Last reviewed as active: 2026-07-27

Removed from active register: 2026-08-21

Owner: security_owner

Status: removed_from_active_register_after_revalidation

Historical finding:
- Package: postcss
- Advisories:
  - GHSA-qx2v-qp2m-jg93
  - GHSA-6g55-p6wh-862q
  - GHSA-r28c-9q8g-f849
- Severity: high
- Context: Dashboard / Next.js production dependency path
- Historical dependency path: node_modules/next/node_modules/postcss
- Historical parent: next@16.2.11
- Historical affected version: 8.4.31

Revalidation evidence on 2026-08-21:
- Current `next`: `16.3.0`
- Current root/dashboard `postcss`: `8.5.23`
- Historical nested path `node_modules/next/node_modules/postcss`: absent in current lockfiles
- `npm audit --omit=dev --json`: `0` vulnerabilities
- `npm run security:audit:production-contexts`: PASS after register cleanup

Decision:
- The historical scoped exception was removed from the active register.
- No blind expiry extension was used.
- No replacement exception was created.
- No current production-context vulnerability for this historical scope was evidenced in the repo state reviewed on 2026-08-21.

Boundary:
- This change does not grant deploy approval.
- This change does not grant enterprise-readiness approval.
- This change does not grant provider-live approval.
- This change does not grant customer-data or production-data approval.
