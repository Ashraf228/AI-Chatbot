# Next/PostCSS Exception Revalidation Report

## Summary

Revalidated the exact-scoped Next-internal PostCSS production-context exception because no stable Next fix is currently available.

## Stable Next Check

- current dashboard Next: `next@16.2.11`
- latest stable checked: `next@16.2.12`
- result: `next@16.2.12` still depends internally on `postcss@8.4.31`
- canary remains forbidden
- major upgrade remains out of scope

## Exact Exception Scope

- package: `postcss`
- parent dependency: `next@16.2.11`
- dependency path: `node_modules/next/node_modules/postcss`
- affected version: `8.4.31`
- accepted advisories:
  - `GHSA-qx2v-qp2m-jg93`
  - `GHSA-6g55-p6wh-862q`
  - `GHSA-r28c-9q8g-f849`
- exact scope only
- no standalone/root `node_modules/postcss` exception
- no broad high waiver
- no critical waiver

## Runtime Exposure Review

- no direct application-level PostCSS processing path for user-supplied CSS identified
- no approved custom-CSS or tenant-CSS pipeline identified
- branding remains limited to validated hex-color fields and allowlisted font values
- widget inline CSS remains locally bundled CSS, not user-supplied CSS
- residual risk remains low under current deployment assumptions, not none

## Revalidation Decision

- status remains: `accepted temporarily, not fixed`
- exact scoped exception remains necessary
- stable Next watch remains required
- no deploy approval
- no enterprise approval
- no customer-data approval

## New Expiry

- previous expiry: `2026-08-06`
- new expiry: `2026-08-20`

## Remaining Caveats

- stable Next upgrade is still required
- any new non-excepted `high` finding remains blocking
- any `critical` finding remains blocking
- revalidation is required again if Dashboard or Widget CSS/theme/branding scope expands

## Checks

- `production-context audit`: `PASS`
- `Authorization Matrix`: `PASS`
- `Security Boundaries`: `PASS`

## Recommended Next Step

- before merge: `P0-NEXT-POSTCSS-EXCEPTION-REVALIDATION-1-D`
- after merge: `P0-NEXT-POSTCSS-EXCEPTION-REVALIDATION-1-E`
- then: `ENT-AGENT-WORKSPACE-PRODUCTIZATION-1`
