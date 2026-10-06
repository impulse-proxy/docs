# Security Model

This page describes the current trust boundaries and security assumptions in the project as it exists today.

## Security Goals

Impulse is designed to:

- terminate downstream TLS for HTTP/3 and bootstrap TLS traffic
- validate and forward requests to configured upstreams with explicit trust settings
- bound resource consumption under malformed, slow, or overloaded traffic
- expose a small operator control surface with authentication

Impulse is not yet designed to be:

- a full web application firewall
- a complete authentication gateway
- a general-purpose policy engine

## Trust Boundaries

### Downstream Client To Impulse

Clients are untrusted. Impulse must:

- parse QUIC and HTTP/3 safely
- validate headers and pseudo-headers strictly
- bound header count and total header bytes
- enforce request-body limits and timeouts
- reject unsupported upgrade-style semantics
- avoid unbounded state growth from malformed packets or connection churn

### Impulse To Upstream Backends

Upstreams are trusted only according to explicit configuration.

- HTTPS upstreams are verified by default.
- SNI is sent by default in strict mode.
- Private trust roots can be configured with `ca_file` and `ca_dir`.
- Disabling upstream certificate verification is allowed, but should be treated as a break-glass mode rather than a normal production stance.

### Operator To Control Plane

The control API is privileged.

- It can expose runtime state.
- It can trigger restart behavior.
- It can trigger certificate reload.
- It must be treated as an admin surface, not a public endpoint.

Admin-plane authentication factors supported today:

- bearer token only
- mTLS only
- mTLS + bearer token

Compatibility mode:

- the legacy `observability.control_api.auth_token` is still accepted
- it is mapped to an admin-scoped static identity to preserve existing behavior during migration
- this is deliberate backward compatibility, not the recommended steady-state production posture
- because the config schema uses `deny_unknown_fields`, compatibility is one-way: newer binaries accept legacy configs, but older binaries reject configs that use the newer nested admin-plane fields

Recommended production posture:

- `observability.control_api.tls.client_auth.mode: required`
- bearer token or role-bearing mTLS identity
- admin-network IP allowlisting
- dedicated audit stream enabled

## Downstream TLS Model

Impulse supports:

- default/fallback certificate identity
- SNI-specific certificates
- bootstrap listener client-auth with optional or required certificate modes

Important scope note:

- current client-auth coverage is centered on the bootstrap listener path
- operators should verify whether their exact ingress shape requires stronger mTLS guarantees on every downstream path before broad rollout

## Admin-Plane Authentication And Authorization Model

The control API admin plane is separate from request-path auth.

Authentication and authorization are evaluated in this order:

1. source-address policy, if `observability.control_api.ip_allowlist` is configured
2. authentication using bearer token, mTLS identity, or both
3. authorization against the route-to-role contract

Role model:

- `viewer`: runtime snapshot and generation history reads
- `operator`: `viewer` plus validate, preview, activate, rollback, reload, and cert reload
- `admin`: `operator` plus restart and future destructive admin actions

Response and failure contract:

- `401 Unauthorized`: missing or invalid authentication
- `403 Forbidden`: authenticated but under-scoped, or denied by source-address policy
- TLS handshake rejection: client certificate missing or invalid when control API mTLS is required

Handshake rejection is not an HTTP response. It terminates the TLS connection before routing and should be diagnosed through control-plane TLS logs and audit output.

Admin-plane route contract:

| Route family | Minimum role |
| --- | --- |
| `/health`, `/ready` | unauthenticated or separately configurable |
| `/admin/runtime` | `viewer` |
| `/admin/runtime/history` | `viewer` |
| `/admin/runtime/history/{generation}` | `viewer` |
| `/admin/runtime/validate` | `operator` |
| `/admin/runtime/preview` | `operator` |
| `/admin/runtime/activate` | `operator` |
| `/admin/runtime/rollback` | `operator` |
| `/admin/runtime/reload` | `operator` |
| `/admin/runtime/reload-certs` | `operator` |
| `/admin/runtime/restart` | `admin` |

## Upstream TLS Model

Upstream trust behavior is controlled by configuration.

Safe posture:

- `verify_certificates: true`
- `strict_sni: true`
- explicit custom CA material when using private PKI

Unsafe posture:

- `verify_certificates: false`
- public or shared-network upstreams with disabled verification

## Resource-Exhaustion Defense Model

Impulse includes multiple defensive layers intended to limit blast radius from abusive or unhealthy traffic:

- new-connection token bucket
- maximum active connection caps
- per-connection stream caps
- global and scoped inflight limits
- route queue caps
- request and response body caps
- body idle and total timeouts
- adaptive admission and brownout controls

These features are part of the project’s security posture because they reduce denial-of-service amplification inside the process.

## Request Authentication And Authorization Model

Per-upstream request authentication is part of the downstream data plane. It
runs before backend dispatch and supports local API-key checks, local JWT
verification, or one external authorization provider. Local policies fail
closed. External policy defaults to fail-closed and may be made fail-open only
as an explicit availability tradeoff.

The trust boundary is strict:

- request authentication lives under `upstream.<name>.auth`
- Control API authentication lives under `observability.control_api`
- identities, roles, credentials, failures, and audit events from one plane do
  not grant access in the other
- JWKS and OIDC endpoints are separate dependencies: JWKS supplies public keys
  for local JWT verification, while OIDC external auth performs discovery and
  token introspection

The exact fields, algorithms, claim behavior, external-auth response contract,
secret references, and reload semantics are documented in
[Authentication and Secrets](/docs/configuration/authentication-and-secrets).

## What Impulse Does Not Currently Provide

Impulse does not currently provide first-class:

- OIDC login flows (interactive/browser SSO) or session-cookie handling
- a generic RBAC/policy engine beyond scope/role checks on JWT claims
- WAF behavior
- deep content inspection
- extensible third-party auth/policy modules

## Recommended Deployment Security Posture

- keep the control API bound to loopback or a strongly isolated admin network
- use explicit admin roles rather than a single all-powerful token when possible
- require control API mTLS in production
- use a strong control API token and rotate it as an administrative secret when bearer auth is enabled
- restrict control API source addresses with `ip_allowlist.cidrs`
- enable the dedicated admin audit stream
- keep upstream certificate verification enabled in production
- run with least privilege after bind
- restrict filesystem write access to the minimum required paths
- monitor handshake failures, overload events, and unexpected restart activity

## Future Security Hardening Priorities

- deeper parser fuzzing
- stronger control-plane auditability
- broader documentation of mTLS behavior across all ingress paths
- explicit support boundaries for admin-plane deployment patterns
- stronger auth/policy features where the product direction requires them

## Related Pages

- [Production Readiness](/docs/operations/production-readiness)
- [Limitations](/docs/reference/limitations)
- [Authentication and Secrets](/docs/configuration/authentication-and-secrets)
- [Control API Reference](/docs/reference/control-api-reference)
- [TLS Setup](/docs/configuration/tls)
