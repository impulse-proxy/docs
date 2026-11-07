# Configuration Reference

Impulse v0.7 accepts YAML schema version `1` and rejects unknown fields. This
page provides concise configuration patterns; each linked topic page owns the
field definitions, defaults, and validation rules for that area.

The first example is complete. Later examples are valid top-level fragments to
merge into it or another complete configuration. Replace certificate paths,
secret files, hostnames, and addresses for your environment.

## Listeners and TLS

Every configuration requires `listen`, at least one upstream, and a complete
downstream TLS identity. A listener serves production HTTP/1.1 and HTTP/2
through Pingora and experimental HTTP/3 on the same bind address and port.

```yaml
version: 1

listen:
  address: "0.0.0.0"
  port: 443
  tls:
    cert: "/etc/impulse/tls/server.crt"
    key: "/etc/impulse/tls/server.key"

upstream:
  default:
    route:
      path_prefix: "/"
    backends:
      - id: "app-1"
        address: "https://app.internal.example:8443"
```

Use `listeners` for multiple binds, `listen.tls.certificates` for exact-SNI
identities, and `listen.tls.client_auth` for downstream mutual TLS. Backend
trust and client certificates belong to `upstream_tls` or an upstream-specific
`tls` block.

Field reference: [TLS Configuration](/docs/configuration/tls).

## Routes and Upstreams

All configured route fields must match. Route precedence is deterministic and
does not depend on YAML declaration order.

```yaml
upstream:
  orders:
    route:
      host: "api.example.com"
      path_prefix: "/v1/orders"
      method: GET
    host_policy:
      mode: upstream
    forwarded_headers:
      mode: overwrite
    backends:
      - id: "orders-1"
        address: "https://orders.internal.example:8443"
```

Field reference: [Routing and Upstreams](/docs/configuration/routing-and-upstreams).

## Load Balancing, Discovery, and Health Checks

Load balancing is configured per upstream. DNS refresh is process-wide, while
health checks belong to individual backends.

```yaml
performance:
  backend_dns_refresh_enabled: true
  backend_dns_refresh_interval_ms: 30000

upstream:
  api:
    route:
      path_prefix: "/"
    load_balancing:
      type: consistent-hash
      key: "header:x-tenant-id"
    backends:
      - id: "api-a"
        address: "https://api-a.internal.example:8443"
        weight: 100
        health_check:
          path: "/ready"
          interval: 5000
          timeout_ms: 1000
          failure_threshold: 3
          success_threshold: 2
          cooldown_ms: 5000
      - id: "api-b"
        address: "https://api-b.internal.example:8443"
        weight: 200
        health_check:
          path: "/ready"
          interval: 5000
          timeout_ms: 1000
          failure_threshold: 3
          success_threshold: 2
          cooldown_ms: 5000
```

Field reference: [Routing and Upstreams](/docs/configuration/routing-and-upstreams)
and [Load Balancing](/docs/user-guide/load-balancing).

## Authentication and Authorization

Authentication is configured on the upstream selected by routing. This example
uses an HS256 key from the bounded file secret provider and requires both a JWT
scope and role.

```yaml
secrets:
  default_provider: runtime_files
  providers:
    runtime_files:
      kind: file
      base_dir: "/run/impulse/secrets"

upstream:
  private_api:
    route:
      host: "api.example.com"
      path_prefix: "/private"
    auth:
      jwt:
        secret_ref:
          ref: "file://jwt-hs256.key"
        issuer: "https://issuer.example.com"
        audience: "impulse-api"
        allowed_algorithms: [HS256]
      required_scopes: ["private:read"]
      required_roles: ["reader"]
    backends:
      - id: "private-1"
        address: "https://private.internal.example:8443"
```

API keys, asymmetric JWT keys, JWKS, and external authorization use the same
`upstream.<name>.auth` boundary.

Field reference: [Authentication and Secrets](/docs/configuration/authentication-and-secrets).

## Rate Limiting and Quota

Scoped limits are local to one Impulse process. Distributed quota can use an
in-memory or Redis counter backend. This example applies both policies to the
`default` upstream from the complete example.

```yaml
resilience:
  scoped_rate_limits:
    - name: "default-by-tenant"
      scope: tenant
      key: "header:x-tenant-id"
      route_allowlist: ["default"]
      requests_per_sec: 50
      burst: 100
      idle_ttl_secs: 300

  quota:
    enabled: true
    enforcement: enforce
    backend_failure_policy: fail_closed
    backend:
      kind: in_memory
      key_prefix: "impulse:quota"
    policies:
      - name: "default-minute"
        route_allowlist: ["default"]
        selector:
          route: true
          tenant:
            key: "header:x-tenant-id"
        burst:
          requests: 100
          window_secs: 1
        sustained:
          requests: 5000
          window_secs: 60
```

Field reference: [Resilience, Rate Limits, and Quota](/docs/configuration/resilience).

## Cache and Compression

Cache and compression are disabled by default and configured per upstream.
Their Cargo features must also be present in the binary.

```yaml
upstream:
  default:
    route:
      path_prefix: "/"
    cache:
      enabled: true
      max_bytes: 67108864
      max_entries: 10000
      max_object_bytes: 1048576
      max_ttl_secs: 300
    compression:
      enabled: true
      minimum_size_bytes: 1024
    backends:
      - id: "app-1"
        address: "https://app.internal.example:8443"
```

`max_bytes` and `max_entries` bound the in-memory cache,
`max_object_bytes` rejects oversized objects, and `max_ttl_secs` caps origin
freshness. Responses without a valid origin freshness directive are not
cached. Compression applies only to eligible negotiated responses at or above
`minimum_size_bytes`.

Build reference: [Plugin Build Profiles](/docs/configuration/plugin-builds).

## Control API and Metrics

Keep operational listeners on loopback unless remote access is deliberately
hardened. The Control API is HTTPS and reuses the primary listener certificate;
the loopback metrics endpoint is plaintext HTTP.

```yaml
secrets:
  default_provider: runtime_files
  providers:
    runtime_files:
      kind: file
      base_dir: "/run/impulse/secrets"

observability:
  metrics:
    enabled: true
    required: true
    address: "127.0.0.1"
    port: 9901
    path: "/metrics"

  control_api:
    enabled: true
    required: true
    address: "127.0.0.1"
    port: 9902
    auth:
      bearer_tokens:
        - token_ref:
            ref: "file://control-api.token"
          role: admin
          actor_id: "ops-automation"
```

Field reference:
[Observability and Control Configuration](/docs/configuration/observability-and-control).
Endpoint reference: [Control API](/docs/reference/control-api-reference) and
[Metrics](/docs/reference/metrics-reference).

## Validation and Activation

Run a candidate on isolated bind addresses for startup validation, or submit it
to `POST /admin/runtime/validate` before preview and activation. A valid startup
continues running; reaching the ready state is the success signal.

Candidate preparation rejects unknown fields, invalid values, missing files,
conflicting routes or listeners, and configuration that requires a plugin not
compiled into the binary. A rejected reload leaves the active generation
unchanged.

## Field Ownership

| Area | Authoritative page |
| --- | --- |
| Defaults | [Configuration Defaults](/docs/configuration/defaults) |
| Listener and backend TLS | [TLS Configuration](/docs/configuration/tls) |
| Routes, upstreams, backends, discovery, and health | [Routing and Upstreams](/docs/configuration/routing-and-upstreams) |
| Authentication, authorization, and secrets | [Authentication and Secrets](/docs/configuration/authentication-and-secrets) |
| Admission, rate limits, quota, retries, and circuit breaking | [Resilience, Rate Limits, and Quota](/docs/configuration/resilience) |
| Cache and compression | [Cache and Compression](#cache-and-compression) |
| Metrics, tracing, Control API, and process security | [Observability and Control Configuration](/docs/configuration/observability-and-control) |
| Compiled plugin availability | [Plugin Build Profiles](/docs/configuration/plugin-builds) |
| Capacity and performance settings | [Sizing and Capacity](/docs/operations/sizing-and-capacity) |

For complete deployment-shaped files, use
[Configuration Examples](/docs/configuration/examples).
