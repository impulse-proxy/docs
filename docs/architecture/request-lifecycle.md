# Request Lifecycle

This page describes the request path shared by the Pingora and experimental
HTTP/3 ingress adapters. It focuses on decision ownership rather than wire
or source-level detail.

See [Architecture Overview](/docs/architecture/overview) for the canonical
crate and subsystem ownership map.

## Flow

```mermaid
flowchart LR
    intake["Ingress intake and validation"] --> route["Route resolution"]
    route --> select["Backend selection"]
    select --> preauth["Selected policy and pre-auth admission"]
    preauth --> auth["External auth when configured"]
    auth --> postauth["Post-auth admission"]
    postauth --> build["Canonical request build"]
    build --> execute["Transport execution, retry, hedge"]
    execute --> normalize["Response normalization and guardrails"]
    normalize --> writeback["Protocol-specific writeback"]
    writeback --> outcome["Outcome and backend feedback"]
```

Route and backend resolution happen before route-scoped policy evaluation so
Impulse knows which upstream policy, pool, and bounded observability identity
apply. A locally rejected request does not proceed to backend dispatch; any
selection accounting is finalized by the outcome path.

## 1. Ingress Intake and Validation

The HTTP/3 adapter owns UDP, QUIC/TLS, HTTP/3 connection and stream state. The
Pingora adapter owns TCP/TLS, HTTP/1.1 or HTTP/2 request intake, and
HTTP/1.1-specific upgrade detection.

Each adapter validates its wire contract and produces the HTTP semantics needed
by shared services. Connection, stream, and Pingora session objects remain adapter-local;
they are not shared request-policy types.

## 2. Route Resolution and Backend Selection

The shared route service matches the validated method, path, and authority
against the active generation's route index. It returns the upstream identity
and match metadata. Edge forwarding then asks the upstream pool to select an
eligible backend using the configured balancing strategy and request-key input.

Selection filters readiness and retry exclusions before returning a backend and
starting attempt accounting.

## 3. Selected Policy and Admission

The chosen upstream supplies the request policy. Pre-auth admission evaluates
local API-key and JSON Web Token (JWT) policy, brownout, and scoped rate
limiting. External
authorization runs next when configured. Post-auth admission applies quota,
route/global/upstream/backend inflight protection, queueing, circuit state, and
adaptive admission as applicable.

Admission services return typed decisions. Pingora and HTTP/3 adapters retain
only response serialization and protocol lifecycle duties; they should not
invent different policy semantics.

## 4. Canonical Upstream Request

After admission, the canonical request builder applies:

- host-policy and forwarded-header application
- auth-approved header mutations
- hop-by-hop request-header filtering
- body-mode shaping
- HTTP/1.1 upgrade request shaping
- the internal H1 and H2 request builders

## 5. Dispatch, Retry, and Hedge

Per-attempt orchestration applies inflight permits, circuit state, retry
budget, hedge eligibility, alternate selection, and request deadlines. Each
attempt is handed to `UpstreamTransportPool` as a backend identity plus a
canonical request.

The transport returns a canonical response or error. Shared classification maps
that result to retryability, health feedback, and stable observability reasons.

## 6. Response and Streaming

`impulse-bridge::response` filters hop-by-hop headers and trailers and decides
bodyless/no-content emission policy. Shared connection guardrails enforce body
size, prebuffer, idle, and total-streaming limits.

The adapters then diverge only for writeback:

- HTTP/3 emits headers, chunks, trailers, and terminal state on the H3
  stream
- Pingora returns an HTTP/1.1 or HTTP/2 response and handles an accepted
  HTTP/1.1 upgrade tunnel where applicable

## 7. Outcome Recording

Every terminal path—success, upstream failure, timeout, local rejection,
overload, client disconnect, or response abort—must finalize through shared
outcome semantics. The outcome layer owns route/backend metrics, pool request
accounting, passive health feedback, retry/hedge telemetry, and canonical
reason mapping.

Adapters provide protocol-specific facts but must not independently redefine
what the terminal result means.

## Invariants

- Equivalent Pingora and HTTP/3 requests receive the same route and policy
  decision unless the downstream protocol itself requires different behavior.
- A route resolves to an upstream before that upstream's policy is evaluated.
- Backend selection and transport execution remain separate decisions.
- Only explicit `http://` backends use upstream HTTP/1.1; HTTPS and schemeless
  backends use upstream HTTP/2 over TLS.
- Every terminal path records an outcome once and releases its accounting and
  admission state.

## Related Pages

- [Architecture Overview](/docs/architecture/overview)
- [Transport and Backend Lifecycle](/docs/architecture/transport-and-backend-lifecycle)
- [Runtime Generation and Configuration Lifecycle](/docs/architecture/runtime-generation)
- [Routing and Upstreams](/docs/configuration/routing-and-upstreams)
