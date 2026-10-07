# Observability and Control Configuration

This page is the focused Impulse v0.6 schema reference for metrics, tracing,
the Control API, and process privilege dropping. It documents configuration
fields and validation rules under the canonical
[Configuration Reference](/docs/configuration/reference). For HTTP methods,
request and response bodies, status codes, and runtime-operation semantics, use the
[Control API Reference](/docs/reference/control-api-reference).

## Top-Level Sections

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `observability.metrics` | object | No | object defaults | Prometheus scrape listener. |
| `observability.control_api` | object | No | object defaults | Administrative HTTPS listener and its security policy. |
| `observability.tracing` | object | No | object defaults | OpenTelemetry trace export. |
| `observability.routing` | object | No | object defaults | Route-decision logging; see the [general reference](/docs/configuration/reference#routing-transparency). |
| `security.privileges` | object | No | object defaults | Unix process privilege drop after listeners bind. |

Unknown fields in these objects are rejected.

## Metrics Endpoint

`observability.metrics` starts a dedicated HTTP/1.1 Prometheus endpoint. It is
disabled and loopback-bound by default.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | boolean | No | `false` | Start the metrics listener. |
| `required` | boolean | No | `false` | Make initial TLS setup, runtime availability, or bind failure fatal when the endpoint is enabled. When false, Impulse logs the failure and continues without the endpoint. |
| `address` | string | No | `"127.0.0.1"` | TCP bind address; must be non-empty when enabled. |
| `allow_non_loopback` | boolean | No | `false` | Permit a non-loopback bind and switch the endpoint to mutual TLS (mTLS). |
| `port` | integer | No | `9901` | TCP port; must be `1..=65535` when enabled. |
| `path` | string | No | `"/metrics"` | Exact GET path; must begin with `/`. |
| `max_connections` | integer | No | `512` | Concurrent accepted-connection cap; must be greater than `0`. Excess connections are dropped. |
| `connection_timeout_ms` | integer | No | `30000` | TLS handshake and connection-service timeout in milliseconds; must be greater than `0`. |

The loopback endpoint is unauthenticated plaintext HTTP. A non-loopback
`address` is rejected unless `allow_non_loopback: true`. Remote mode also
requires `observability.control_api.tls.client_auth.mode: required`; it serves
mutual TLS (mTLS) using the primary listener's server certificate and the Control API
client-CA configuration. Control API bearer tokens do not authenticate metrics
scrapes.

Endpoint behavior is intentionally small: `GET` on the configured `path`
returns Prometheus text, another path returns `404`, and another method returns
`405`. Metric names and labels are defined by the
[Metrics Reference](/docs/reference/metrics-reference).

```yaml
observability:
  metrics:
    enabled: true
    address: "127.0.0.1"
    port: 9901
    path: "/metrics"
```

## Tracing

`observability.tracing` configures the process-wide OpenTelemetry trace
pipeline and its OpenTelemetry Protocol (OTLP) exporter.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | boolean | No | `false` | Initialize OpenTelemetry tracing at process startup. |
| `service_name` | string | No | `"impulse"` | Value exported as `service.name`; must be non-empty when enabled. |
| `otlp_endpoint` | string or `null` | No | `null` | OTLP/gRPC collector endpoint; when tracing is enabled, a present value must be non-empty. |
| `sample_ratio` | number | No | `1.0` | Trace-ID ratio sampling value; when tracing is enabled, it must be in the inclusive range `0.0..=1.0`. |

When `otlp_endpoint` is omitted, endpoint resolution uses this precedence:

1. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
2. `OTEL_EXPORTER_OTLP_ENDPOINT`
3. `http://127.0.0.1:4317`

Exporter initialization failure is logged and leaves tracing unavailable; it
does not stop listener startup. Every tracing field is startup-owned, so a
runtime activation that changes it is rejected as restart-required.

```yaml
observability:
  tracing:
    enabled: true
    service_name: "impulse-edge"
    otlp_endpoint: "http://otel-collector.internal.example:4317"
    sample_ratio: 0.1
```

## Control API Listener

`observability.control_api` starts a dedicated HTTP/1.1-over-TLS listener. The
server certificate, private key, and SNI mappings come from the primary
effective listener. The `control_api.tls` block below adds client-certificate
verification; it does not select a separate server certificate.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | boolean | No | `false` | Start the Control API listener. |
| `required` | boolean | No | `false` | Make initial TLS setup, runtime availability, or bind failure fatal when enabled. When false, Impulse logs the failure and continues without the API. |
| `address` | string | No | `"127.0.0.1"` | TCP bind address; must be non-empty when enabled. |
| `port` | integer | No | `9902` | TCP port; must be `1..=65535` when enabled. |
| `health_path` | string | No | `"/health"` | Exact liveness GET path. |
| `ready_path` | string | No | `"/ready"` | Exact readiness GET path. |
| `runtime_path` | string | No | `"/admin/runtime"` | Base path for the runtime read and the derived validate, preview, activate, rollback, and history routes. |
| `restart_path` | string | No | `"/admin/runtime/restart"` | Exact restart POST path. |
| `reload_path` | string | No | `"/admin/runtime/reload"` | Exact legacy reload POST path. |
| `reload_certs_path` | string | No | `"/admin/runtime/reload-certs"` | Exact certificate-reload POST path. |
| `auth_token` | string or `null` | No | `null` | Legacy literal bearer token, assigned `admin`; mutually exclusive with `auth_token_ref`. |
| `auth_token_ref` | secret-reference object or `null` | No | `null` | Secret reference for the legacy `admin` bearer token. |
| `tls` | object | No | object defaults | Control API client-certificate policy. |
| `auth` | object | No | object defaults | Role-bearing bearer tokens and optional mTLS identity mapping. |
| `authorization` | object | No | object defaults | Route-family RBAC and health/readiness protection. |
| `ip_allowlist` | object | No | object defaults | Pre-authentication source-address policy. |
| `audit` | object | No | object defaults | Administrative audit-event output. |
| `max_connections` | integer | No | `256` | Concurrent accepted-connection cap; must be greater than `0`. Excess connections are dropped. |
| `connection_timeout_ms` | integer | No | `30000` | TLS handshake and connection-service timeout in milliseconds; must be greater than `0`. |

Every configured route path must start with `/`, contain no query, fragment,
backslash, or control character, and—except `/`—must not end in `/`. Static
method/path pairs must not collide, and GET paths must not conflict with the
derived `${runtime_path}/history/{generation}` namespace. These path and
security constraints are enforced when the Control API is enabled.

`address` and `port` are startup-owned and a runtime change to either requires
a restart. `required` governs initial startup failure handling. Other Control
API policy and path fields are installed with an accepted runtime generation.

## Control API TLS and Authentication

### Client Certificates

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `tls.client_auth.mode` | `disabled`, `optional`, or `required` | No | `disabled` | Disable certificate requests, accept an unauthenticated TLS client, or require a verified client certificate. |
| `tls.client_auth.ca_file` | string or `null` | Conditional | `null` | PEM CA bundle. At least one of `ca_file` or `ca_dir` is required for `optional` or `required`. |
| `tls.client_auth.ca_dir` | string or `null` | Conditional | `null` | Directory of PEM CA files. At least one CA certificate must load across the configured sources. |

`optional` mTLS is not an authentication mechanism by itself: configure a
bearer token as well. `required` mTLS may be the sole transport authentication
mechanism, but privileged HTTP routes also require an mTLS-derived role as
described below.

### Bearer Tokens and mTLS Identity

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `auth.bearer_tokens` | array | No | `[]` | Static, role-bearing bearer credentials. |
| `auth.bearer_tokens[].token` | string | Conditional | `""` | Literal token; exactly one of `token` or `token_ref` is required per entry. |
| `auth.bearer_tokens[].token_ref` | secret-reference object or `null` | Conditional | `null` | `literal:` or `file://` reference; mutually exclusive with `token`. |
| `auth.bearer_tokens[].role` | `viewer`, `operator`, or `admin` | No | `viewer` | Role granted by the token. |
| `auth.bearer_tokens[].actor_id` | string or `null` | No | `null` | Non-empty stable principal recorded in audit events. |
| `auth.identity_source` | object or `null` | No | `null` | Extract an actor and, optionally, roles from the verified client certificate. Requires optional or required mTLS. |
| `auth.identity_source.kind` | string | Conditional | `""` | Actor source: `mtls_subject_cn`, `mtls_san_dns`, `mtls_san_uri`, or `mtls_subject`. |
| `auth.identity_source.role_attribute` | string or `null` | No | `null` | Certificate-subject attribute containing `viewer`, `operator`, or `admin`; `CN`, `O`, and `OU` aliases are recognized. |

Literal tokens must be non-empty and cannot use known placeholder values.
Duplicate literal tokens cannot assign conflicting roles or actors. The legacy
`auth_token` and `auth_token_ref` remain compatibility fields and always grant
`admin`; new configuration should use `auth.bearer_tokens`.

Secret-reference syntax, resolution, and reload behavior are documented in
[Authentication and Secrets](/docs/configuration/authentication-and-secrets#secret-references).

When bearer and mTLS identities are both presented and both yield actor IDs,
the IDs must match. The effective role is limited to the less-privileged role
asserted by the two mechanisms.

When the Control API is enabled, the configuration must provide at least one
legacy or role-bearing bearer token, or set client-auth mode to `required`.
Mode `disabled` or `optional` without a bearer credential is rejected.

## Role-Based Access Control (RBAC) and Protected Probes

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `authorization.protect_health` | boolean | No | `false` | Require `runtime_read_role` for the health route. |
| `authorization.protect_ready` | boolean | No | `false` | Require `runtime_read_role` for the readiness route. |
| `authorization.runtime_read_role` | role | No | `viewer` | Minimum role for runtime and history reads, and for protected probes. |
| `authorization.runtime_mutate_role` | role | No | `operator` | Minimum role for validate, preview, activate, rollback, reload, and certificate reload. |
| `authorization.restart_role` | role | No | `admin` | Minimum role for restart. |

Roles are ordered `viewer < operator < admin`. Validation requires
`runtime_mutate_role >= runtime_read_role` and
`restart_role >= runtime_mutate_role`. Protection changes access to the health
and readiness routes; their response semantics remain defined in the
[Control API Reference](/docs/reference/control-api-reference#endpoints).

## Source Internet Protocol (IP) Allowlist

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `ip_allowlist.cidrs` | array of CIDR strings | No | `[]` | Allowed client networks. Empty permits every source. |
| `ip_allowlist.trusted_proxy_cidrs` | array of CIDR strings | No | `[]` | Peers trusted to supply a sanitized `Forwarded` or `X-Forwarded-For` chain. |
| `ip_allowlist.trust_proxy_headers` | boolean | No | `false` | Resolve the source from forwarding headers when the direct peer is trusted. |

CIDRs must contain a valid IPv4 or IPv6 address and prefix length.
`trust_proxy_headers: true` requires at least one `trusted_proxy_cidrs` entry.
Headers from an untrusted peer are ignored. A trusted proxy must send exactly
one header family—`Forwarded` or `X-Forwarded-For`; ambiguous or malformed
chains are denied. The source policy runs before bearer-token validation.

## Audit Output

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `audit.enabled` | boolean | No | `false` | Emit Control API administrative audit events. |
| `audit.format` | `json` | No | `json` | Audit serialization format. |
| `audit.sink` | `log` or `file` | No | `log` | Send events to the dedicated audit log target or append them to a file. |
| `audit.file_path` | string or `null` | Conditional | `null` | When the Control API is enabled, required and non-empty for `sink: file` and rejected for `sink: log`. |

The file sink uses a bounded buffer and appends with restrictive Unix
permissions. Writer startup, write, and buffer failures are logged and counted;
events may be dropped rather than blocking the request path. The event schema
and field meanings are in the
[Control API Reference](/docs/reference/control-api-reference#audit-event-shape).

## Hardened Control API Example

This is a configuration fragment; the primary listener must also provide the
server TLS identity used by this HTTPS listener.

```yaml
observability:
  control_api:
    enabled: true
    required: true
    address: "10.0.10.5"
    port: 9902
    tls:
      client_auth:
        mode: required
        ca_file: "/etc/impulse/pki/admin-ca.pem"
    auth:
      bearer_tokens:
        - token_ref:
            ref: "file://control-operator.token"
          role: operator
          actor_id: "ops-automation"
      identity_source:
        kind: mtls_subject_cn
        role_attribute: OU
    authorization:
      protect_health: true
      protect_ready: true
      runtime_read_role: viewer
      runtime_mutate_role: operator
      restart_role: admin
    ip_allowlist:
      cidrs: ["10.0.10.0/24"]
      trusted_proxy_cidrs: []
      trust_proxy_headers: false
    audit:
      enabled: true
      format: json
      sink: file
      file_path: "/var/log/impulse/control-api-audit.jsonl"
    max_connections: 256
    connection_timeout_ms: 30000
```

## Privilege Dropping

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `security.privileges.enabled` | boolean | No | `true` | If the process starts with effective UID `0`, drop privileges after control-plane and data-plane listeners bind. |
| `security.privileges.user` | string | No | `"nobody"` | Target operating-system user; must be non-empty when enabled. |
| `security.privileges.group` | string | No | `"nogroup"` | Target operating-system group; must be non-empty when enabled. |

On Unix, Impulse resolves the configured user and group, clears supplementary
groups, applies the target GID and UID, and verifies that it is no longer root.
Failure is fatal. If the process did not start as root, this setting is a no-op;
use `CAP_NET_BIND_SERVICE` or ports at or above `1024` when an unprivileged
process must bind listeners. The runtime service account still needs read
access to configuration, certificates, secret files, and any files used by
later reloads, plus write access to configured log and audit paths.

```yaml
security:
  privileges:
    enabled: true
    user: impulse
    group: impulse
```

## Operational Guidance

For trust boundaries and the production-hardening baseline, use the
[Security Model](/docs/concepts/security-model). For rollout, failure, and
monitoring procedures, use
[Control Plane Operations](/docs/operations/control-plane).

## Related Pages

- [Control API Reference](/docs/reference/control-api-reference)
- [Metrics Reference](/docs/reference/metrics-reference)
- [Observability Operations](/docs/operations/observability)
- [Operations Runbook](/docs/operations/runbook)
