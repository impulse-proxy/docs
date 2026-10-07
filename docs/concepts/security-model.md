# Security Model

This page is the conceptual authority for Impulse trust boundaries, threat
assumptions, and production-hardening posture. It does not define configuration
keys, defaults, endpoint payloads, or feature status; use the linked references
for those contracts.

## Security Goals and Assumptions

Impulse is designed to:

- terminate TLS-protected downstream transports
- reject malformed or policy-disallowed requests before backend dispatch
- authenticate selected application requests and administrative callers
- verify secure upstream connections according to explicit trust policy
- bound per-connection, per-request, and process-wide resource consumption
- activate complete runtime generations without exposing partially applied policy
- expose operational state without exposing resolved secret values

Assume that public clients, request contents, forwarded identity headers, and
network traffic outside explicitly protected segments are hostile. Treat
operators, deployment automation, configured trust roots, and the service
account as privileged. Treat upstream applications and external dependencies as
separate systems whose identities and availability must be verified rather than
inherited from their network location.

Impulse is not a web application firewall, malware scanner, general policy
engine, identity provider, secret manager, or service-mesh control plane. The
authoritative list of missing and partial protections is in
[Status and Limitations](/docs/reference/status-and-limitations#security-and-policy-limits).

## Trust-Boundary Map

| Boundary | Trust assumption | Primary risk | Required posture |
| --- | --- | --- | --- |
| Public data plane | Clients and request data are untrusted | Parser abuse, spoofed identity, resource exhaustion, unauthorized backend access | Authenticate transport and requests where required; validate input; enforce bounded admission and body/stream limits |
| Bootstrap path | TCP/TLS compatibility clients are as untrusted as native HTTP/3 clients | Treating compatibility ingress as a privileged or weaker-policy path | Apply the same runtime policy as native ingress and secure TCP independently from UDP |
| Control plane | Callers can observe or mutate privileged runtime state | Unauthorized activation, restart, secret reload, or state disclosure | Isolate the network, authenticate identities, enforce least privilege, and retain audit evidence |
| Metrics and health endpoints | Operational output is sensitive even when read-only | Topology/state disclosure, probe abuse, scrape saturation | Keep endpoints private; authenticate remote metrics and protect probes when exposure requires it |
| Upstream network | Backends and supporting services are external trust domains | Server impersonation, plaintext interception, poisoned discovery, dependency failure | Verify TLS identities, constrain egress, and make failure policy explicit |
| Secret storage | Files, configuration sources, process memory, and deployment systems can disclose credentials | Credential or private-key theft, stale material, unsafe rollback | Minimize plaintext copies and readers, use atomic rotation, and keep secret values out of telemetry |

## Public Data Plane

The native QUIC listener accepts HTTP/3 over UDP. Every packet, connection,
header, body, authority, and application credential arriving there is
untrusted. TLS protects the connection and identifies the server; it does not
by itself authorize the application request. Downstream client certificates or
per-upstream request authentication are separate, opt-in controls.

The request path validates protocol structure, normalizes routing inputs, and
applies authentication, admission, routing, backend selection, and transport
policy before outcome recording. Header/body caps, stream and connection caps,
timeouts, scoped limits, adaptive admission, circuit breaking, and brownout
reduce denial-of-service amplification; they do not make abusive traffic safe
or replace capacity planning and upstream protection.

Do not trust a client-supplied forwarding header as proof of identity. Forwarded
headers sent upstream are governed by Impulse policy, while caller identity for
authentication or quota must come from the configured trusted source.

Exact controls:

- [Authentication and Secrets](/docs/configuration/authentication-and-secrets)
- [TLS Configuration](/docs/configuration/tls#downstream-listener-tls)
- [Resilience, Rate Limits, and Quota](/docs/configuration/resilience)
- [Protocol Support](/docs/protocols/support)

## Bootstrap Path

The bootstrap listener is a public compatibility adapter, not an administrative
bootstrap channel. It accepts HTTP/1.1 or HTTP/2 over TCP/TLS on the configured
listener port and advertises HTTP/3 availability. It shares the active runtime
generation, request policy, routing, admission, backend selection, and upstream
transport with native QUIC ingress.

Protocol-specific parsing, connection handling, response writeback, and the
supported HTTP/1.1 WebSocket upgrade path remain separate code paths. That
separation creates an additional attack surface even though policy meaning is
shared. Expose and filter TCP and UDP deliberately, monitor both, and validate
the exact protocol pair used by upgrade or CONNECT traffic. Impulse provides no
cleartext HTTP bootstrap listener.

Exact behavior is defined in [Protocol Support](/docs/protocols/support) and
[Request Lifecycle](/docs/architecture/request-lifecycle).

## Control Plane

The Control API is a privileged administrative surface. Read operations expose
runtime generations and health state; mutations can validate or activate
configuration, roll back runtime state, reload listener certificates, or request
a controlled restart. Compromise can therefore disclose deployment state or
change request handling.

Control-plane authentication is independent of downstream request
authentication. An application API key, JWT, or external-authorization decision
never grants administrative access. Administrative identities should be named,
limited to the minimum role required, and attributable in a dedicated audit
stream. Network isolation remains necessary even when bearer authentication and
mTLS are enabled.

The Control API should be reachable only from loopback or a strongly isolated
administration network. Remote operation should use mutually authenticated TLS,
source restrictions, short-lived or rotated credentials, bounded connections,
and monitored audit delivery. A trusted proxy is part of this boundary: accept
forwarded source identity only from explicitly controlled proxy peers.

Exact contracts:

- [Observability and Control Configuration](/docs/configuration/observability-and-control#control-api-listener)
- [Control API Reference](/docs/reference/control-api-reference)
- [Control Plane Operations](/docs/operations/control-plane)

## Metrics and Health Endpoints

Metrics, health, and readiness are read-only but not necessarily public. Metrics
can reveal route, upstream, backend, failure, certificate, and runtime state.
Probe results reveal process availability and deployment transitions. Exposure
also consumes connections and rendering work.

The normal posture is private scraping and probing over loopback or an isolated
observability network. The default loopback metrics endpoint is plaintext and
unauthenticated; remote metrics mode requires mTLS. Health and readiness belong
to the TLS Control API listener and can be protected when the probe system can
authenticate. Control API bearer credentials do not authenticate metrics
scrapes.

Do not publish metrics or probes merely because they are read-only. Apply
network policy, connection bounds, scrape timeouts, and monitoring for scrape or
audit failure. Exact endpoint fields are in
[Observability and Control Configuration](/docs/configuration/observability-and-control);
endpoint semantics are in the
[Control API Reference](/docs/reference/control-api-reference).

## Upstream Network

Routing a request to a configured backend does not make the network path or
backend identity trustworthy. HTTPS backends should retain certificate and
hostname verification, with explicit private trust roots where required.
Disabling verification removes server authentication and is a temporary
break-glass tradeoff, not a production trust model. Cleartext HTTP/1.1 backends
must remain inside a separately protected network segment.

Upstream client certificates identify Impulse to a backend but do not establish
that the backend is healthy, authorized for every request, or safe to return
unbounded data. Health checks, response limits, timeouts, and outcome recording
remain independent controls.

DNS resolvers, external authorization services, JWKS/OIDC endpoints, telemetry
collectors, and distributed-quota storage are also outbound dependencies. Their
network reachability, TLS identity, data sensitivity, and fail-open/fail-closed
behavior are part of the deployment threat model. Restrict egress to the
services the active configuration requires.

Exact TLS fields and verification behavior are in
[TLS Configuration](/docs/configuration/tls#upstream-backend-tls). Authentication and
external-service behavior are in
[Authentication and Secrets](/docs/configuration/authentication-and-secrets).

## Secret Storage

Impulse consumes credentials and private keys; it is not their system of
record. A value referenced from a file is still plaintext in that file and in
process memory after resolution. Inline credentials also exist in the source
configuration. Redaction from debug output or runtime views reduces accidental
disclosure but does not protect the source file, process, backup, or deployment
pipeline.

Grant the final service identity read access only to the configuration,
certificate, key, CA, and secret files it needs for startup and later reloads.
Limit writers to the deployment or rotation authority. Keep log, audit, and
runtime-state write paths separate from secret sources. Replace material
atomically, retain a recoverable prior version for the verification window, and
remove it according to the organization's retention policy after successful
rotation.

Do not emit raw secrets, bearer tokens, private keys, sensitive request headers,
or unsanitized configuration into logs, metrics, traces, audit records, or
incident bundles. A rollback restores retained resolved generation state; it is
not a secret-store restore and does not necessarily reread an edited file.

Exact provider, reference, resolution, failure, and reload behavior is in
[Authentication and Secrets](/docs/configuration/authentication-and-secrets#secret-providers-and-references).
Certificate rotation is in
[Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation).

## Cross-Boundary Invariants

- Downstream request identities and Control API identities never authorize one another.
- Native QUIC and bootstrap ingress share policy meaning; neither is a policy bypass.
- Metrics and probes observe runtime state but do not own or mutate the active generation.
- Runtime activation publishes a complete prepared generation or leaves the previous generation active.
- Downstream TLS identity, upstream TLS trust, and Control API client identity are distinct trust decisions.
- Resource limits contain work; they do not authenticate clients or prove backend health.
- Runtime views, metrics, and audit output describe secret state without exposing secret values.

## Production Hardening Baseline

Review this baseline for every environment; deployment-specific evidence belongs
in the [Production Checklist](/docs/deployment/production#production-checklist).

1. **Segment networks.** Expose only the public listener. Keep the Control API,
   metrics, probes, upstreams, and supporting services on explicitly allowed
   administration, observability, or service networks.
2. **Authenticate every crossed boundary.** Use valid downstream certificates,
   request authentication where the application requires it, verified upstream
   TLS, and strongly authenticated administrative identities.
3. **Apply least privilege.** Separate viewer, operator, and restart authority;
   run as an unprivileged service identity; grant only required bind capability
   and filesystem access.
4. **Protect secret material.** Prefer constrained file-backed references over
   inline values, control readers and writers, rotate atomically, and monitor
   expiry and reload failures.
5. **Bound work.** Size connection, stream, body, queue, inflight, retry, and
   control-plane limits from representative capacity tests; preserve overload
   protection during incidents.
6. **Make changes attributable and reversible.** Use staged activation, retain
   known-good artifacts, enable administrative audit output, and alert on audit
   loss, authentication failure, unexpected restart, and security-control drift.
7. **Test both ingress paths.** Exercise UDP/HTTP/3 and TCP bootstrap behavior,
   including TLS, routing, auth, limits, and failure responses, before rollout.

## Configuration Authority

| Security concern | Exact authority |
| --- | --- |
| Downstream API keys, JWT, external authorization, OIDC, secret providers and references | [Authentication and Secrets](/docs/configuration/authentication-and-secrets) |
| Downstream certificates/client authentication and upstream TLS/mTLS | [TLS Configuration](/docs/configuration/tls) |
| Control API TLS, bearer identities, RBAC, source policy, audit, metrics/probes, and privilege drop | [Observability and Control Configuration](/docs/configuration/observability-and-control) |
| Control API methods, access results, and payloads | [Control API Reference](/docs/reference/control-api-reference) |
| Admission, rate limits, quota, CONNECT constraints, and body/header limits | [Resilience, Rate Limits, and Quota](/docs/configuration/resilience) |
| Current and partial security feature status | [Status and Limitations](/docs/reference/status-and-limitations#resilience-security-and-policy) |
| Unsupported security behavior | [Status and Limitations](/docs/reference/status-and-limitations#security-and-policy-limits) |

## Related Pages

- [Production Deployment](/docs/deployment/production)
- [Operations Runbook](/docs/operations/runbook)
- [Protocol Support](/docs/protocols/support)
