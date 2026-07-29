# Dashboard Layout CSS Stability 1 Report

## Summary

- run_id: `dashboard-layout-css-stability-1`
- run_type: `dashboard_p0_layout_css_stability`
- layout/CSS stability improved: yes
- workspace layout stabilized: yes
- setup wizard layout stabilized: yes
- customer create layout stabilized: yes
- knowledge/testchat layout stabilized: yes
- boundary context preserved: yes
- manual visual QA still required: yes
- API code changed: no
- dashboard code changed: yes
- guided customer demo: still blocked
- self-service customer demo: blocked
- real pilot: blocked

## UI/CSS Changes

- `apps/dashboard/app/globals.css`
- stabilizes workspace shell segments, setup step wrapping, method/source grids, transcript separation, and responsive button/action behavior
- `apps/dashboard/components/customer/CustomerStatusBar.tsx`
- turns the workspace header into clearer segments and keeps boundary context visible without crowding action rows
- `apps/dashboard/components/customer/CustomerSetupWizard.tsx`
- removes the setup-wizard live-activation CTA from the review step
- `apps/dashboard/components/customer/setup-wizard/KnowledgeSourceCard.tsx`
- makes long titles and action rows more stable
- `apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx`
- separates composer and local transcript more clearly
- `apps/dashboard/components/sites/SiteForm.tsx`
- compacts the metadata-first customer create flow and visually demotes advanced/legacy sections

## Stabilized Areas

- workspace shell header
- setup wizard sidebar/content spacing
- setup step card wrapping
- customer create form density
- knowledge source card action layout
- internal testchat composer/transcript separation
- review card presentation

## Responsive / Overflow Notes

- status pills and long labels can now wrap more safely
- dense action rows reflow earlier on narrower widths
- auto-fit grids reduce card overlap risk in knowledge and setup areas
- no screenshot-based proof was produced; manual browser QA remains required

## Regression Coverage

- `apps/dashboard/test/CustomerStatusBar.test.tsx`
- verifies boundary context stays visible and no live activation CTA appears in the workspace header
- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- verifies internal review/testchat still renders and the launch CTA is not shown
- `apps/dashboard/test/SiteForm.test.tsx`
- verifies metadata-first create flow and secondary legacy placement remain intact

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy
- public widget activation
- production activation
- customer data usage

## Manual Visual QA

- still required before any external demo
- especially for long site names, long status labels, and dense advanced diagnostics content

## Safety Confirmation

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no screenshots
- no recordings
- no package or lockfile changes
- no DB migration
- no new persistence
- no provider calls
- no query runner

## Recommended Next Step

- `DASHBOARD-P0-ROLE-AND-DEMO-ACCESS-CLARITY-1`
