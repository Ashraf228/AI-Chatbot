# Webhook HMAC Signatures

This document describes the signed webhook contract used by the isolated Evaluation demo handoff. It is not a public NOLIS integration contract.

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

## Evaluation Mock Handoff

The Evaluation mock handoff uses a fixed internal receiver path:

```text
/internal/evaluation/mock-handoff/v1
```

The browser can only request a handoff by conversation ID. It cannot provide receiver URLs, secrets, signatures, event IDs, delivery IDs, payloads, tenant IDs, site IDs, roles, or forwarding status.

## Legacy Generic Webhooks

Existing generic ticket webhooks may still use the legacy `x-webhook-secret` header for backward compatibility. That mode is considered `legacy_secret_header` and should not be used by the Evaluation mock handoff.
