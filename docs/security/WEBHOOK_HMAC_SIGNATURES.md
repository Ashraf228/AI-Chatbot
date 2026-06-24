# Webhook HMAC Signatures

This document describes the signed webhook contract used by the isolated Evaluation demo handoff and by new generic webhook connections. It is not a public NOLIS integration contract.

## Contract

- Mode: `hmac_sha256`
- Version: `v1`
- Signature header: `x-ssb-signature`
- Signature format: `v1=<lowercase-hex-digest>`
- Signed bytes: UTF-8 bytes of `<x-ssb-timestamp>.` followed by the exact raw JSON request body bytes.
- Required headers:
  - `content-type: application/json`
  - `x-ssb-event-id`
  - `x-ssb-delivery-id`
  - `x-ssb-event-type`
  - `x-ssb-timestamp`
  - `x-ssb-signature`

The sender serializes JSON exactly once, signs that byte buffer, and sends the same buffer. Receivers must verify the raw request body before parsing JSON.

## Replay Window

The default timestamp tolerance is 300 seconds. Configured values are accepted only between 30 and 600 seconds. A value of `0` is invalid and falls back to the default.

## Secrets

Signing secrets are base64 encoded and must decode to at least 32 bytes. They are never sent in headers, payloads, logs, audit metadata, dashboard DTOs, or documentation.

## Generic Webhooks

New generic webhook connections use `hmac_sha256` by default. The sender serializes the JSON payload once, stores the exact UTF-8 payload bytes for the queued job, signs those bytes for each delivery attempt, and sends the same bytes in the HTTP request.

Retry semantics:

- `x-ssb-event-id` remains stable for the logical webhook job.
- `x-ssb-delivery-id` is new for each delivery attempt.
- `x-ssb-timestamp` and `x-ssb-signature` are regenerated for each attempt.
- The stored payload bytes remain unchanged across retries.

Transport authentication remains separate. Existing Bearer tokens or API keys may still be sent as transport headers when configured. The HMAC signing secret itself is not sent.

User-configured headers cannot override reserved `x-ssb-*` headers or `x-webhook-secret`.

## Evaluation Mock Handoff

The Evaluation mock handoff uses a fixed internal receiver path:

```text
/internal/evaluation/mock-handoff/v1
```

The browser can only request a handoff by conversation ID. It cannot provide receiver URLs, secrets, signatures, event IDs, delivery IDs, payloads, tenant IDs, site IDs, roles, or forwarding status.

## Legacy Generic Webhooks

Existing generic webhooks may still use the legacy `x-webhook-secret` header for backward compatibility. That mode is called `legacy_secret_header`.

Rules:

- Existing legacy connections are not migrated automatically.
- The normal new-connection flow must not offer `legacy_secret_header` as a selectable mode.
- A migration to HMAC-SHA256 requires receiver-side verification, a new or confirmed HMAC secret, and explicit Platform Owner approval.
- The Evaluation mock handoff remains HMAC-only.

Review target for legacy mode: `2026-07-24`. This is a review date, not a shutdown commitment.
