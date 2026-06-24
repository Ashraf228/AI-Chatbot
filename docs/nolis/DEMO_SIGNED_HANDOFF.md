# NOLIS Demo Signed Handoff

This document describes the isolated signed handoff demonstrator. It is not a production NOLIS integration and does not send data to NOLIS or an external ticket system.

## Purpose

After a viewer explicitly confirms a synthetic product-support ticket in the Evaluation Workspace, the viewer can manually trigger a signed internal mock handoff. The handoff demonstrates:

- stable event identity,
- unique delivery attempts,
- HMAC-SHA256 signature verification,
- replay-window validation,
- duplicate recognition,
- sanitized status reporting in the browser.

## Activation

The feature is off by default. The API requires:

```text
EVALUATION_MOCK_HANDOFF_ENABLED=true
EVALUATION_MOCK_RECEIVER_ORIGIN=<origin only>
EVALUATION_MOCK_HANDOFF_SECRET_B64=<base64 secret, at least 32 bytes>
EVALUATION_MOCK_SIGNATURE_TOLERANCE_SECONDS=300
EVALUATION_MOCK_HANDOFF_TIMEOUT_MS=5000
```

`EVALUATION_MOCK_RECEIVER_ORIGIN` must be an origin without path, query, fragment, or credentials. HTTPS is required in production. HTTP is only acceptable for local or internal test environments.

## Browser Flow

1. Viewer creates a synthetic Evaluation chat session.
2. Viewer confirms a sanitized product-support ticket.
3. The workspace shows `Noch keine Demo-Übergabe ausgeführt.`
4. Viewer clicks `Signierte Demo-Übergabe simulieren`.
5. The API signs the stored byte-stable payload and sends it to the fixed internal mock receiver.
6. The UI shows:
   - `Die signierte Demo-Übergabe wurde vom internen Mock-Empfänger bestätigt.`
   - `Es erfolgte keine Übermittlung an NOLIS oder ein externes Ticketsystem.`

## Data Boundaries

The payload omits:

- tenant IDs,
- site IDs,
- viewer IDs,
- reporter email/name,
- model metadata,
- embeddings,
- retrieval scores,
- internal database IDs,
- secrets,
- request headers.

Only sanitized synthetic demo ticket fields are included.

## Retry and Dedupe

One logical event is created per confirmed Evaluation ticket. Retries keep the same event ID, raw payload bytes, and payload hash. Each delivery attempt receives a new delivery ID, timestamp, and signature. The internal receiver stores one receipt per event and detects duplicates without exposing event or delivery IDs in the browser.
