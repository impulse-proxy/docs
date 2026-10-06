# Control Plane

This document explains the operator-facing control-plane services in Impulse and the boundaries each service is allowed to know about runtime state.

## Operator Fast Path

Use the control plane to answer four questions quickly:

1. what runtime generation is active now
2. what changed recently
3. what is the current backend, quota, or watchdog state
4. can an operator action proceed safely

## Services

The control plane consists of four main operator-facing surfaces:

- control API
- metrics endpoint
- watchdog service
- audit stream

These services are not listener sidecars anymore. They are explicit services built from canonical runtime views and shared services.

## Control API

The control API is the privileged administrative HTTP surface.

Its responsibilities are:

- health and readiness checks
- runtime snapshot rendering
- staged runtime operations such as validate, preview, activate, and rollback
- legacy runtime reload
- listener certificate reload
- controlled restart requests

### Transport and protocol expectations

- protocol: HTTP/1.1 over TLS
- audience: operators and automation only
- security model: a dedicated admin-plane authn/authz layer, separate from request-path auth

### Security and endpoint authorities

Control API configuration—TLS client authentication, bearer credentials, mTLS
identity extraction, RBAC thresholds, protected probes, IP allowlists, audit
sinks, and connection limits—is defined only in
[Observability and Control Configuration](/docs/configuration/observability-and-control).

HTTP methods, route access behavior, request and response fields, and status
semantics are defined only in the
[Control API Reference](/docs/reference/control-api-reference). The
[Security Model](/docs/concepts/security-model#control-plane) owns the trust
boundary and production-hardening posture.

### Failure semantics

Control API authn/authz failures are intentionally split:

- `401 Unauthorized`: missing authentication or invalid authentication material
- `403 Forbidden`: authenticated but insufficient role, or denied by pre-auth source-address policy

Control API mTLS failure is separate:

- when `observability.control_api.tls.client_auth.mode: required`, missing or invalid client certificates fail the TLS handshake
- that failure happens before HTTP routing, so there is no HTTP `401` or `403` payload
- operators should rely on control-plane TLS handshake logs for diagnosis; no
  HTTP audit event exists before a request is established

### Route families

The current route family includes:

- health
- ready
- runtime
- runtime history
- staged runtime operations: validate, preview, activate, rollback
- reload-certs
- reload
- restart

Refer to [Control API Reference](/docs/reference/control-api-reference) for concrete endpoints.

### What the control API is allowed to know

The control API should read from:

- canonical runtime generation view
- shared runtime services
- backend lifecycle inventory
- watchdog state

It should not depend on listener-local internals that only exist because a particular ingress path happens to hold them.

### Runtime introspection contract

For operators, the highest-value reads are:

- `GET /admin/runtime`
- `GET /admin/runtime/history`
- `GET /admin/runtime/history/{generation}`

Those views should provide:

- active generation
- runtime history and rollback candidates
- backend health summary
- quota backend health summary
- watchdog state
- observability contract version
- audit schema version
- dashboard and documentation references
- recent admin actions

## Metrics Endpoint

The metrics endpoint is the Prometheus scrape surface.

Its responsibilities are:

- expose rendered Prometheus text
- validate the configured scrape path
- stay bound to the current runtime metrics surface

### Operator expectations

- only the configured metrics path returns metrics
- wrong paths return `404`
- response content type is Prometheus text format
- metrics are rendered from the canonical shared metrics registry

The metrics endpoint is intentionally simpler than the control API. It is a read-only scrape surface, not an administration interface.

Operator rule:

- use metrics for trend, rate, and alerting
- use the control API for current state and generation-aware introspection

## Watchdog Service

The watchdog is the control-plane coordinator for runtime liveness degradation and controlled restart workflows.

Its responsibilities are:

- monitor poll progress and service health
- mark the runtime degraded when thresholds are crossed
- request controlled restarts
- coordinate drained worker completion across the runtime

### Important watchdog state

Operators should expect the watchdog to surface:

- whether it is enabled
- whether the system is degraded
- whether a restart has been requested
- restart reason
- restart request timestamp
- whether all expected workers have drained

This state is surfaced through control-plane runtime views rather than by reading listener internals directly.

## Audit Stream

The audit stream is the control-plane history surface.

Use it when you need:

- actor attribution
- authn and authz failure history
- attempt versus result history for runtime operations
- reasoned failure records for restart, activate, rollback, reload, or cert reload

The audit stream is low-cardinality and operator-oriented. It is not a request-body or request-header log.

## Runtime View Contract

All control-plane services should depend on the same runtime model:

- active runtime generation
- shared runtime services
- generation-owned state where relevant

This ensures:

- metrics and control API describe the same active generation
- restart and reload actions act on the same authoritative runtime handle
- backend lifecycle state is rendered from one canonical inventory

### Observability package entry point

`GET /admin/runtime` and the runtime history reads are also the operator entry point into the
packaged observability bundle.

The runtime/control-plane views now expose:

- current active generation
- observability contract version
- audit schema version
- backend health summary
- quota backend health summary
- recent tracked admin/runtime actions when history exists
- dashboard definition references
- documentation references

This is what lets operators move from:

- metric
- to dashboard
- to runtime snapshot
- to generation history
- to audit attribution

without changing vocabulary.

These references are repository asset paths, not UI URLs. Operators and automation should treat
them as stable package identifiers that can be mapped into Grafana imports, runbooks, or internal
control-plane tooling without assuming one frontend.

## Authentication and Access Model

### Control API

Use separate credentials and policy for the admin plane; downstream API keys,
JWTs, and external authorization do not authorize these routes. The default
roles are `viewer` for reads, `operator` for non-restart mutations, and `admin`
for restart, but the thresholds and probe protection are configurable. An
mTLS-only caller needs a certificate attribute mapped to a role before it can
use privileged routes. See the configuration and endpoint authorities linked
above for exact behavior.

### Metrics endpoint

The default loopback metrics endpoint is plaintext and unauthenticated. Remote
exposure is an explicit mTLS mode that reuses the primary listener certificate
and Control API client-CA policy; bearer tokens do not apply. Network-exposure
guidance belongs to the
[Security Model](/docs/concepts/security-model#metrics-and-health-endpoints).

### Watchdog

The watchdog is not a public HTTP surface. It is an internal coordinator surfaced through metrics and control API snapshots.

## Separation from the Data Plane

Control-plane code should be able to answer operator questions without becoming part of the request hot path.

That means:

- no request-path policy logic should live in control-plane services
- no control-plane-only state should be required to serve requests
- admin surfaces should observe canonical runtime state, not own it

## Operational Expectations

Operators should expect the control plane to answer questions such as:

- what runtime generation is active
- is the system ready to serve
- is the watchdog degraded or requesting restart
- what do backend health and placement look like
- can a reload be applied safely
- what observability package version and audit schema version the node is serving
- what recent admin actions have been recorded

They should not need to infer those answers indirectly from unrelated logs.

## Failure Behavior

When control-plane services fail, the desired behavior is:

- fail clearly
- leave the active data plane intact
- preserve the authoritative runtime generation unless an explicit swap succeeded

For example:

- a rejected reload must leave the active generation unchanged
- a metrics scrape failure should not affect request serving
- a control API bind or TLS initialization failure should be treated as an explicit service failure, not hidden behind data-plane behavior

## Contributor Rules

When adding operator-facing functionality:

- put administrative request handling in control API modules
- put scrape-only rendering in metrics modules
- put restart/degraded coordination in watchdog
- read runtime state through canonical runtime views

Do not:

- add listener-local state dependencies only to satisfy an admin surface
- duplicate runtime snapshot assembly in multiple services
- let control-plane services become alternate owners of runtime state

## Related Pages

- [Observability Operations](/docs/operations/observability)
- [Reload and Drain](/docs/operations/reload-and-drain)
- [Control API Reference](/docs/reference/control-api-reference)
- [Observability and Control Configuration](/docs/configuration/observability-and-control)
- [Security Model](/docs/concepts/security-model)
