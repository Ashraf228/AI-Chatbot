# Dashboard Layout CSS Stability

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `75416e0928bf01d8eef44b6daeb669460c6223cb`
- Scope: stabilize layout, spacing, overflow handling, and CTA hierarchy across customer workspace, setup wizard, customer create, knowledge, and internal test/review areas
- Goal was layout/CSS stability only, not a new product feature
- No deploy was executed
- No public widget was activated
- No production activation was approved
- Guided customer demo remains blocked
- Self-service customer demo remains blocked
- Real pilot remains blocked

## Previous Problem

- workspace header and action rows became too dense on smaller and medium widths
- setup step cards and review cards could feel cramped and visually noisy
- customer create still consumed unnecessary vertical space for a metadata-only flow
- knowledge source actions and long labels could sprawl across unstable rows
- internal testchat input and transcript were not clearly separated enough
- review/live areas still risked implying a live activation path too early

## Layout Scope

- customer workspace shell
- setup wizard shell, sidebar, and step cards
- customer create / site form
- knowledge source cards and add-source area
- internal testchat / review transcript area
- review card and boundary presentation

## Stabilized Areas

- workspace shell now uses clearer segment blocks for status, active focus, and next-step guidance
- workspace action buttons wrap more predictably and no longer depend on one crowded row
- setup wizard shell keeps sidebar and content widths more controlled
- setup step cards now wrap labels/status more safely instead of relying on tighter single-line assumptions
- customer create form now groups primary metadata fields side-by-side and pushes advanced/legacy inputs into a secondary visual layer
- knowledge source cards now handle long titles and action rows more safely
- internal testchat now separates composer and local transcript more clearly
- review cards use a clearer card treatment instead of looking like loose text links
- the review step no longer renders a live-activation CTA from the setup wizard actions

## Responsive / Overflow Notes

- header/action areas now reflow into full-width rows on smaller viewports
- long status pills, labels, and badges are allowed to wrap instead of forcing overflow
- knowledge/testchat and setup step structures now keep `min-width: 0` boundaries where needed
- method cards and source actions use more forgiving auto-fit grids
- no normal workspace area should require horizontal scrolling for the updated surfaces

## Regression Coverage

- customer workspace boundary context remains visible
- setup/source-of-truth semantics remain unchanged
- review/live remains review-only
- customer create remains metadata-only
- knowledge save-and-continue gating remains unchanged
- internal testchat remains internal/test-only
- navigation/workspace shell grouping remains intact

## Manual Visual QA Still Required

- visual browser QA remains required before any external demo
- smaller-width verification should still be done manually for:
- long site names
- long boundary/status labels
- longer technical transcript content
- denser advanced diagnostics content

## Remaining Follow-up Fixes

- role and demo access wording can be clarified further if needed
- advanced diagnostics density may still benefit from a later copy/terminology pass
- visual QA should confirm no new overlap in routes not directly covered by the targeted tests

## Safety Boundaries

- no deploy
- no public widget activation
- no production activation
- no enterprise approval
- no customer data
- no production data
- no production secrets
- no DB migration
- no package or lockfile changes
- no new knowledge persistence
- no new PDF content persistence
- no chat history persistence
- no website crawling
- no provider calls
- no query runner
- no real tickets, emails, or webhooks

## Next Step

- Recommended next P0: `DASHBOARD-P0-ROLE-AND-DEMO-ACCESS-CLARITY-1`
