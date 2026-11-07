# Feature and Limitation Matrix

This is the canonical capability summary for Impulse v0.7.0. Impulse is pre-GA
software intended for controlled production rollout. Pingora HTTP/1.1 and
HTTP/2 are the production ingress path; HTTP/3 remains experimental.

| Status | Meaning |
| --- | --- |
| **Supported** | Implemented for the boundary stated below. This does not imply GA or interface stability. |
| **Experimental** | Available for evaluation but outside the production support boundary. |
| **Partial** | Implemented only for the named modes or protocol pairs. |
| **Build-selected** | Available only when its Cargo feature is compiled into the binary. |
| **Not available** | No first-class v0.7 implementation. |

## Feature and Limitation Matrix

| Area | Capability | Status | v0.7.0 boundary |
| --- | --- | --- | --- |
| Ingress | HTTP/1.1 and HTTP/2 | **Supported** | Pingora over TLS/TCP. Cleartext HTTP/1.1 and h2c ingress are not available. |
| Ingress | HTTP/3 | **Experimental** | QUIC with TLS 1.3 over UDP. Uses the shared runtime but must be evaluated independently. |
| Upstream | HTTP/1.1 | **Supported** | Selected by an explicit `http://` backend address. |
| Upstream | HTTP/2 | **Supported** | Selected by `https://` or a schemeless secure backend address. |
| Upstream | HTTP/3 | **Not available** | Impulse does not connect to backends over HTTP/3. |
| Tunnels | WebSocket | **Partial** | Pingora HTTP/1.1 upgrade requires an `http://` backend. HTTP/3 uses extended CONNECT. Pingora HTTP/2 is not an HTTP/1.1 upgrade path. |
| Tunnels | CONNECT | **Partial** | Disabled by default and constrained by route and authority/port policy. It is not a general forward-proxy surface. |
| Routing | Host, path-prefix, and method | **Supported** | Exact or leading-wildcard host, segment-aware path prefix, normalized method, and deterministic precedence. Header/query/cookie route matching is not available. |
| Load balancing | Backend selection | **Supported** | Round-robin, random, consistent hash, least connections, latency aware, and sticky CID. Custom weights are not accepted by least-connections or latency-aware strategies. |
| Discovery and health | DNS and backend readiness | **Partial** | DNS refresh, last-known-good membership, active/passive health, thresholds, and cooldowns are supported. xDS, Consul, and Kubernetes-native discovery are not available. |
| Authentication | API keys | **Build-selected** | Per-upstream header authentication through `api-key-auth`. Keys are configured values, not dynamic identities. |
| Authentication | JWT and JWKS | **Build-selected** | `HS256`, `RS256`, and `ES256`, static keys or direct JWKS URL, issuer/audience checks, and required scopes/roles through `jwt-auth`. No generic policy language. |
| Authentication | External authorization | **Build-selected** | Generic HTTP decisions and OIDC discovery/introspection through `external-auth`. No browser login, SSO, or session management. |
| Admission | Connection and request rate limits | **Build-selected** | Connection limiting, scoped local token buckets, and distributed quota are separate features. Core inflight, queue, body, and overload protection remain host-owned. |
| Caching | Response cache | **Build-selected** | Shared H1/H2/H3 eligibility and key policy with bounded in-memory storage. No disk or distributed cache. Authorization, cookies, bodies, private responses, and unsupported `Vary` values bypass caching. |
| Compression | Response compression | **Build-selected** | Shared negotiated streaming gzip for eligible H1/H2/H3 responses. Brotli and Zstandard are not available. |
| TLS | Downstream TLS and mTLS | **Supported** | Default and exact-SNI identities with optional or required client certificates on Pingora and HTTP/3. No CRL or OCSP validation. |
| TLS | Upstream TLS and mTLS | **Supported** | Certificate and hostname verification, custom CA material, and optional client identity for HTTP/2 backends. |
| Runtime | Validate, preview, and activate | **Supported** | Whole-file candidate generations are prepared before atomic publication. Invalid or unavailable-plugin candidates leave the active generation unchanged. |
| Runtime | Rollback | **Supported** | Publishes a retained eligible generation. History is bounded and is not a durable configuration, binary, or secret backup. |
| Runtime | Live configuration reload | **Partial** | Routes, upstreams, runtime policies, and `log.level` activate live. Listener removal/bind changes, operational listener binds, logging sink/format, tracing startup settings, control-plane threads, and cache storage limits require restart. |
| Runtime | Certificate rotation | **Partial** | Downstream material at unchanged paths uses `reload-certs`; upstream TLS and downstream path/policy changes use generation activation. Existing sessions retain negotiated TLS state. |
| Operations | Metrics, logs, traces, and status | **Supported** | Prometheus, plain/JSON logs, optional OTLP tracing, runtime snapshots, bounded history, and per-process audit output. Audit is not a durable fleet log. |
| Build | Full profile | **Supported** | Default `plugins-full` binary contains connection limiting, API-key auth, JWT auth, external auth, scoped rate limiting, quota, cache, and compression. Compiled does not mean active. |
| Build | Minimal profile | **Supported** | `plugins-minimal` contains connection-rate limiting only. Authentication, quota, cache, and compression configuration is rejected. |
| Build | Custom profile | **Supported** | `--no-default-features` plus explicit plugin features. Startup and reload reject configuration requiring a plugin absent from the binary. |
| Extensions | Runtime-loaded plugins, WAF, or scripting | **Not available** | Plugins are compiled Rust implementations. There is no Lua, WebAssembly, dynamic third-party extension, WAF, or content-inspection runtime. |
| Platform | Fleet control plane | **Not available** | Runtime management is per-process and file-backed; there is no granular object API, xDS/ADS fleet service, or Kubernetes operator. |
| Packaging | Host and container deployment | **Partial** | Debian/systemd assets and a production Dockerfile exist. v0.7 does not publish a canonical public registry image. |

Exact behavior belongs in the focused references:

- [Protocol Support](/docs/protocols/support)
- [Plugin Build Profiles](/docs/configuration/plugin-builds)
- [Authentication and Secrets](/docs/configuration/authentication-and-secrets)
- [Resilience, Rate Limits, and Quota](/docs/configuration/resilience)
- [Reload and Drain](/docs/operations/reload-and-drain)
- [Production Deployment](/docs/deployment/production)

Release changes are recorded in the
[repository changelog](https://github.com/impulse-proxy/impulse/blob/master/CHANGELOG.md)
and [GitHub Releases](https://github.com/impulse-proxy/impulse/releases).
