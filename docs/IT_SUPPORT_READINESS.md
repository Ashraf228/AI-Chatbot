# IT Support Readiness

This document describes the dashboard readiness indicator for the IT support agent. The indicator is read-only and does not change site settings, modules, knowledge sources, templates or integrations.

## Purpose

The dashboard card `IT-Support-Agent Status` shows whether a site is ready to use the IT support agent and which setup steps still need attention.

Status values:

- `ready` / `Produktionsbereit`: core modules, ticket settings, knowledge preparation and forwarding checks are satisfied.
- `warning` / `Fast bereit`: the agent is usable, but operational points should be reviewed before go-live.
- `not_ready` / `Nicht bereit`: blocking setup is missing.

## Checks

The readiness endpoint checks:

- IT-Support module enabled.
- Knowledge-FAQ module enabled.
- Required ticket fields are valid.
- Required base fields are present: `description`, `affectedSystem`, `impact`, `reporterEmail`.
- Final ticket confirmation is required.
- Escalation keywords are configured.
- Ticket forwarding for `ticket.created` is configured.
- Active knowledge sources are available.
- IT knowledge templates are available and whether any were imported.

## Typical Missing Points

Blocking missing points:

- IT-Support module is disabled.
- Knowledge-FAQ module is disabled.
- Required ticket fields are empty or invalid.
- Required base ticket fields are incomplete.

Warnings:

- Ticket forwarding is not configured.
- No active knowledge source or imported IT template exists.
- Escalation keywords are empty.
- Ticket confirmation is not marked as required.

Missing ticket forwarding means tickets can still be stored, but they are not automatically forwarded to an external system.

## Data Protection And Security

- The readiness endpoint is site-scoped.
- It returns counts and status only.
- It does not return knowledge content.
- It does not return signing secrets or integration secret values.
- If a webhook secret exists, the response only returns `hasSigningSecret: true`.

## Dashboard Actions

The card may link to:

- Module settings.
- Knowledge Base.
- Ticket forwarding configuration.
- Test chat.
- Ticket webhook test area.

The IT knowledge template import action is shown as disabled until a dedicated dashboard import UI exists.

## No Automatic Side Effects

The readiness endpoint and dashboard card do not:

- Activate modules.
- Import templates.
- Create webhook configuration.
- Send test webhooks.
- Seed data.
- Change live customer data.
