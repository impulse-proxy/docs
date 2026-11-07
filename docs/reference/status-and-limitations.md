# Status and Limitations

This page is the canonical Impulse v0.7.0 reference for release maturity,
capability status, partial-support boundaries, hard product limitations, and
current support boundaries. Configuration, endpoint, metric, and protocol references
remain authoritative for exact behavior inside a supported capability.

## Release Status

| Field | Current value |
| --- | --- |
| Documentation and capability baseline | Impulse v0.7.0 |
| Release maturity | Pre-GA |
| Deployment posture | Controlled production rollout |
| License | Apache 2.0 |

Impulse v0.7.0 is **pre-GA**. Its core edge path is implemented and suitable for a
controlled production rollout with canaries, monitoring, rehearsed rollback,
and an accountable operating team. Pre-GA does not mean that interfaces are
frozen, every deployment shape has equal production history, or Impulse has
feature parity with general-purpose proxies and API gateways.

Operators can rely on the documented v0.7.0 contracts for Pingora HTTP/1.1 and
HTTP/2 ingress, HTTP/1.1 and HTTP/2 backends,
deterministic routing, load balancing, health, resilience, staged runtime
activation, and operator telemetry. They should still read release notes before
upgrading and validate each target environment using the
[Production Deployment](/docs/deployment/production) workflow.
HTTP/3 ingress remains experimental.

## Status Definitions

| Status | Definition | Reader rule |
| --- | --- | --- |
| `Done` | The capability is implemented and supported for the exact v0.7.0 contract linked or described. | Do not infer additional protocols, integrations, algorithms, or deployment modes beyond that contract. `Done` does not mean GA or API-frozen. |
| `Experimental` | The capability is available for evaluation but is outside the production support contract. | Validate it independently and expect its compatibility boundary to change. |
| `Partial` | A usable implementation exists, but an important mode, protocol pair, lifecycle path, or policy dimension is intentionally absent or restart-bound. | Read the boundary in the matrix and the linked reference before adopting it. Do not treat an adjacent supported mode as evidence that the omitted mode works. |
| `Missing` | Impulse has no first-class implementation of the capability in v0.7.0. | Keep the concern in another component or choose a different product; configuration cannot enable it. |

A restriction is not automatically `Partial`. A capability is `Done` when its
documented scope is complete—for example, downstream protocols are done even
though cleartext ingress is outside the product contract. `Partial` is reserved
for a named broader capability whose implemented subset can easily be mistaken
for full support.

## Capability Matrix

### Protocol, Routing, and Traffic Management

| Capability | Status | v0.7.0 boundary |
| --- | --- | --- |
| HTTP/3 ingress | `Experimental` | QUIC with TLS over UDP through the independent HTTP/3 adapter. |
| Pingora HTTP/1.1 and HTTP/2 ingress | `Done` | TLS over TCP; no cleartext ingress or h2c. |
| HTTP/1.1 and HTTP/2 backends | `Done` | `http://` selects HTTP/1.1; `https://` or schemeless secure addresses select HTTP/2. Mixed pools are supported. |
| Upstream HTTP/3 | `Missing` | Backends are not reached over HTTP/3. |
| WebSocket and CONNECT | `Partial` | Pingora HTTP/1.1 upgrade and HTTP/3 extended CONNECT paths exist, but support depends on the downstream/backend protocol pair and is not general forward proxying. |
| Host, path-prefix, and method routing | `Done` | Exact/wildcard host, segment-aware prefix, normalized method, and deterministic precedence. |
| Header, query, or cookie route matching | `Missing` | These inputs can be load-balancing/quota keys, but are not route matchers. |
| Load-balancing strategies | `Done` | Round-robin, random, consistent-hash, least-connections, latency-aware, and sticky-CID. |
| Weighted backends | `Partial` | Round-robin, random, consistent-hash, and sticky-CID support custom weights; least-connections and latency-aware reject them. |
| Release traffic controls | `Missing` | No route-level weighted splitting, request mirroring, or fault injection. |

### Resilience, Security, and Policy

| Capability | Status | v0.7.0 boundary |
| --- | --- | --- |
| Health and backend lifecycle | `Done` | Active/passive health, thresholds, cooldowns, DNS refresh, client rotation, and runtime inventory. |
| Retry, retry budget, hedging, circuit breaking | `Done` | Implemented within the request replayability, body state, budget, and failure-class rules in the resilience reference. |
| Admission and overload protection | `Done` | Connection/inflight/body/queue bounds, adaptive admission, and brownout. |
| Scoped rate limits and distributed quota | `Done` | Local scoped rules plus Redis-backed burst/sustained quota with explicit degraded-mode policy. |
| API-key, JSON Web Token (JWT), JSON Web Key Set (JWKS), and external auth | `Done` | Per-upstream request authentication with the documented algorithms, claims, key sources, and external-decision contracts. |
| Request-path RBAC/policy engine | `Partial` | Required scopes and roles are enforced for JWT claims; there is no generic policy-expression engine or provider chain. |
| OpenID Connect (OIDC)/auth gateway | `Partial` | Discovery and token introspection are supported; interactive login, browser single sign-on (SSO), and session-cookie management are not. |
| Downstream TLS/client authentication | `Done` | Default and exact Server Name Indication (SNI) identities plus optional/required client certificates on Pingora and HTTP/3 ingress. |
| Upstream TLS and client mutual TLS (mTLS) | `Done` | Certificate/hostname verification, custom certificate authority (CA) material, and optional client identity for secure backends. |
| Web application firewall (WAF), content inspection, and dynamic extensions | `Missing` | No WAF, malware/content inspection, or runtime-loaded Lua/WebAssembly extension API. Built-in policies use the compiled plugin runtime. |

### Configuration, Control, and Operations

| Capability | Status | v0.7.0 boundary |
| --- | --- | --- |
| Staged runtime generations | `Done` | Validate, preview, and activate operate on whole file-backed candidates; history and rollback manage retained generations. |
| Restart-free configuration changes | `Partial` | Runtime-managed domains activate atomically; listener removal/bind changes and startup-owned logging sink/format, tracing, and control-plane thread settings still require restart. |
| Dynamic route changes | `Partial` | Routes change through whole-generation activation; there is no per-route mutation API. |
| Service discovery | `Partial` | Hostname-based Domain Name System (DNS) refresh is implemented; there is no xDS, Consul, Kubernetes-native, or general membership API. |
| Control API security | `Done` | TLS, bearer tokens, mTLS identity, three fixed roles, source policy, connection bounds, and audit output. |
| Metrics, logs, tracing, and runtime views | `Done` | Prometheus, plain/JSON logs, optional OpenTelemetry Protocol (OTLP) tracing, runtime snapshots, and audit events. |
| Debian/systemd packaging | `Done` | Packaging assets and host-service guidance are present. |
| Container artifact | `Partial` | A production Dockerfile and Compose workflow are present; v0.7.0 has no registry-publication workflow or canonical public image reference. |
| Production operations guidance | `Done` | Deployment guide, capacity guidance, observability operations, rotation workflow, and symptom-driven runbook are present. |

## Product Limitations

### Configuration and Control Plane

- Runtime management is whole-file and generation-based, not a granular object
  API or fleet configuration service.
- Listener removal or bind-address changes and other startup-owned settings
  require a drain-aware restart or node replacement.
- Runtime history and rollback candidates are retained to a fixed bound, not as
  permanent fleet-wide change history.
- Dynamic backend membership is DNS-based; there is no first-class membership
  mutation API or external control-plane protocol.
- Control API HTTP transport is HTTP/1.1 over TLS only.

See [Runtime Generation and Configuration Lifecycle](/docs/architecture/runtime-generation)
and the [Control API Reference](/docs/reference/control-api-reference).

### Protocol and Traffic Management

- Impulse accepts production HTTP/1.1/HTTP/2 through Pingora and experimental
  HTTP/3 over QUIC; it does
  not accept cleartext HTTP/1.1 or h2c ingress.
- Backends use HTTP/1.1 or HTTP/2, not HTTP/3.
- Active QUIC connection migration, HTTP/3 server push, HTTP datagrams, and
  WebTransport are not implemented.
- CONNECT and WebSocket behavior is protocol-pair dependent and is not a
  universal tunneling surface.
- There is no header/query/cookie route matcher, route-level weighted traffic
  split, request mirroring, or fault injection.
- There is no general request/response rewrite pipeline.

See [Protocol Support](/docs/protocols/support) and
[Routing and Upstreams](/docs/configuration/routing-and-upstreams).

### Security and Policy Limits

- Local JWT verification supports `HS256`, `RS256`, and `ES256` only. It does
  not support `RS384`/`RS512`, `PS*`, `EdDSA`, or ECDSA curves other than P-256.
- JWKS uses a direct URL and a process-local cache; there is no discovery-based
  JWKS resolution or cross-instance cache. A token matching both a static key
  and a JWKS key is rejected as ambiguous.
- Request authorization is limited to configured authentication plus JWT
  scope/role requirements; there is no generic policy engine.
- OIDC external auth performs discovery and introspection only. It does not
  provide login flows or session management.
- Admin RBAC has the fixed `viewer`, `operator`, and `admin` roles. It does not
  support custom roles or per-route expressions.
- Control API mTLS has no CRL or OCSP checking. Revoking a compromised client
  certificate requires rotating the trusted CA material or otherwise removing
  its trust path.
- When bearer and mTLS admin identities are both presented, their actor
  identities must reconcile; when both provide roles, the less-privileged role
  is effective.
- The administrative audit stream is per process and has no delivery guarantee,
  tamper evidence, or built-in fleet aggregation.
- Impulse is not a WAF, identity provider, malware scanner, or secret manager.

See [Security Model](/docs/concepts/security-model),
[Authentication and Secrets](/docs/configuration/authentication-and-secrets),
and [Observability and Control Configuration](/docs/configuration/observability-and-control).

### Platform and Ecosystem

- There is no Kubernetes operator, xDS/ADS control plane, Consul integration,
  service-mesh mode, or dynamically loaded third-party extension ecosystem.
- The repository can build a container, but the v0.7.0 release process does not
  publish an official registry image.
- Production evidence is narrower than for mature incumbent proxies; validate
  the exact clients, backends, load profile, churn, and failure modes used by
  your deployment.

## Releases

- [Repository changelog](https://github.com/impulse-proxy/impulse/blob/master/CHANGELOG.md) records version-by-version behavior and compatibility notes.
- [GitHub Releases](https://github.com/impulse-proxy/impulse/releases) provides tagged release notes and published artifacts.
- [Production Deployment](/docs/deployment/production) defines the controlled-rollout and readiness workflow.

## Related Pages

- [Protocol Support](/docs/protocols/support)
- [Security Model](/docs/concepts/security-model)
- [Configuration Reference](/docs/configuration/reference)
- [Production Deployment](/docs/deployment/production)
