# Configuration Reference

This page is the authority for the Impulse v0.6 configuration schema and its
runtime semantics. It answers these questions for every major configuration
area:

- what the section is for
- what fields exist
- what values are allowed
- what the defaults are
- what runtime behavior the settings change
- what operators should be careful about

Use [Configuration Defaults](/docs/configuration/defaults) for the exhaustive default inventory and [Configuration Examples](/docs/configuration/examples) for complete deployment patterns. Use this page when you need exact schema and semantics.

For resilience, scoped rate-limit, and quota fields, see
[Resilience, Rate Limits, and Quota](/docs/configuration/resilience). Redis
deployment, rollout, and incident guidance is in
[Distributed Quota Operations](/docs/operations/distributed-quota).

## Scope

This page documents the accepted YAML keys, defaults, validation constraints,
and runtime meaning of Impulse v0.6 configuration. Unknown fields are rejected.
For the complete default inventory, see
[Configuration Defaults](/docs/configuration/defaults). For deployment-shaped
files, see [Configuration Examples](/docs/configuration/examples).

Impulse loads YAML with `impulse --config /path/to/config.yaml`. If `--config`
is omitted, it attempts `/etc/impulse/config.yaml`.

## Top-Level Configuration

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `version` | integer | No | `1` | Configuration schema version. Impulse v0.6 accepts only version `1`. |
| `listen` | object | Yes | — | Single listener definition. The key is required even when `listeners` is used. |
| `listeners` | array of objects | No | `[]` | Effective listener set when non-empty; otherwise `listen` is used. |
| `upstream` | map of objects | Yes | — | Named upstream pools. The map must contain at least one entry. |
| `load_balancing` | object or `null` | No | `null` | Accepted and validated, but not applied as a v0.6 runtime fallback; configure each upstream instead. |
| `upstream_tls` | object | No | `{}` | Global backend TLS policy inherited by upstreams that omit `tls`. See [TLS Configuration](/docs/configuration/tls#upstream-backend-tls). |
| `secrets` | object | No | `{}` | Literal and file-backed secret-provider configuration. See [Authentication and Secrets](/docs/configuration/authentication-and-secrets). |
| `log` | object | No | `{}` | Logging level and output configuration. |
| `performance` | object | No | `{}` | Timeouts, limits, worker settings, buffers, and backend DNS refresh. |
| `observability` | object | No | `{}` | Metrics, tracing, Control API, and runtime-view endpoints. |
| `resilience` | object | No | `{}` | Admission, queueing, retry, circuit-breaker, brownout, and protocol policies. |
| `security` | object | No | `{}` | Process-security and privilege-drop settings. |

Top-level `listen` is required by the schema. If `listeners` contains one or
more entries, those entries are the effective listeners and the values inside
`listen` are not validated or activated. Effective listener `(address, port)`
pairs must be unique.

Per-upstream `tls` replaces the global `upstream_tls` policy for that upstream.
The top-level `load_balancing` field is accepted and validated, but v0.6 does
not apply it to upstreams. An upstream that omits its own `load_balancing` uses
the per-upstream default, `round-robin`.

### Minimal complete configuration

```yaml
version: 1
listen:
  address: "0.0.0.0"
  port: 9889
  tls:
    cert: "/etc/impulse/tls/server.crt"
    key: "/etc/impulse/tls/server.key"
upstream:
  app:
    route:
      path_prefix: "/"
    backends:
      - id: "app-1"
        address: "https://app.internal:8443"
```

## Listener Configuration

The `listen` object and every `listeners[]` entry use the same schema. Each
effective listener creates a native QUIC listener and its bootstrap listener.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `protocol` | string | No | `http3` | Listener protocol. The only accepted value is the case-sensitive string `http3`. |
| `address` | string | No | `0.0.0.0` | Non-empty bind address. |
| `port` | integer | No | `9889` | Bind port in the range `1`–`65535`. |
| `tls` | object | No | `{}` | Listener TLS identities and optional client authentication. A valid effective listener must define a complete TLS identity. |

The bootstrap listener accepts HTTP/1.1 and HTTP/2 traffic and advertises the
native QUIC listener with `Alt-Svc`. Both listener paths use the same routes,
upstreams, load balancing, and backend health state.

### Listener TLS

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `cert` | string | Conditionally | `""` | Default certificate PEM path. Must be paired with `key`. |
| `key` | string | Conditionally | `""` | Default private-key PEM path. Must be paired with `cert`. |
| `certificates` | array of objects | No | `[]` | Exact-SNI certificate identities. Required when the default `cert`/`key` pair is absent. |
| `certificates[].server_name` | string | Yes | — | Exact DNS hostname used for SNI selection. Wildcards and ports are rejected. |
| `certificates[].cert` | string | Yes | — | Certificate PEM path for this identity. |
| `certificates[].key` | string | Yes | — | Private-key PEM path for this identity. |
| `client_auth` | object | No | `{}` | Downstream mutual-TLS policy. |
| `client_auth.enabled` | boolean | No | `false` | Enables client-certificate verification. |
| `client_auth.require_client_cert` | boolean | No | `false` | Rejects clients without a certificate. Requires `enabled: true`. |
| `client_auth.ca_file` | string or `null` | Conditionally | `null` | Client CA PEM path. Required when client authentication is enabled. |

Certificate and key files must be readable PEM files no larger than 1 MiB.
Normalized SNI names must be unique. Certificate selection uses an exact SNI
match first, then the default `cert`/`key` pair, then the first
`certificates[]` entry. An unmatched or absent SNI therefore uses the default
identity. Certificate reload affects new handshakes, not established
connections.

Downstream SNI normalization, SAN coverage, optional and required client-auth
behavior, and atomic reload semantics are documented in
[TLS Configuration](/docs/configuration/tls#downstream-listener-tls).

```yaml
listen:
  protocol: http3
  address: "0.0.0.0"
  port: 9889
  tls:
    certificates:
      - server_name: "api.example.com"
        cert: "/etc/impulse/tls/api.crt"
        key: "/etc/impulse/tls/api.key"
```

## Upstream TLS

The top-level `upstream_tls` policy applies to each upstream that omits its own
`tls` object. A present `upstream.<name>.tls` object replaces the complete
global policy rather than merging with it. These settings affect only
`https://` backends.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `verify_certificates` | boolean | No | `true` | Verifies the backend certificate chain and identity. |
| `strict_sni` | boolean | No | `true` | Sends the backend hostname as SNI; disabling it does not disable certificate verification. |
| `ca_file` | string or `null` | No | `null` | PEM CA bundle added to the built-in WebPKI roots. |
| `ca_dir` | string or `null` | No | `null` | Directory of `.pem`, `.crt`, or `.cer` CA files added to the built-in roots. |
| `client_certificate` | string or `null` | Conditionally | `null` | PEM client-certificate chain path; mutually exclusive with `client_certificate_ref`. |
| `client_certificate_ref` | object or `null` | Conditionally | `null` | Secret reference for the client-certificate chain. |
| `client_key` | string or `null` | Conditionally | `null` | PEM client-key path; mutually exclusive with `client_key_ref`. |
| `client_key_ref` | object or `null` | Conditionally | `null` | Secret reference for the client key. |

Client certificate and key sources must form a complete pair and require at
least one HTTPS backend. Inline paths and references may be mixed across the
pair, but a field and its `_ref` counterpart cannot both be set. CA material,
client identities, verification semantics, examples, and activation behavior
are documented in
[TLS Configuration](/docs/configuration/tls#upstream-backend-tls).

```yaml
upstream:
  private_api:
    route:
      path_prefix: "/"
    tls:
      verify_certificates: true
      strict_sni: true
      ca_file: "/etc/impulse/tls/backend-ca.pem"
      client_certificate_ref:
        ref: "file://private-api/client-chain.pem"
      client_key_ref:
        ref: "file://private-api/client-key.pem"
    backends:
      - id: "private-api-1"
        address: "https://private-api.internal:8443"
```

## Routing and Upstreams

The top-level `upstream` map defines routes, backend pools, per-upstream
policies, and load balancing. Each entry requires a `route` and a non-empty
`backends` array. Per-upstream load balancing defaults to `round-robin`.

Exact host, path, method, wildcard, precedence, backend, health-check,
request-key, strategy-alias, and weight semantics are consolidated in
[Routing and Upstreams](/docs/configuration/routing-and-upstreams). Use
[Load Balancing](/docs/user-guide/load-balancing) for strategy-selection
guidance.

## Authentication and Secrets

Downstream request authentication is configured per upstream under
`upstream.<name>.auth`. It supports API keys, local JWT verification with
static or JWKS keys, and HTTP or OIDC-introspection external authorization.
The top-level `secrets` object configures file-backed secret resolution used by
supported `*_ref` fields.

Exact fields, defaults, validation rules, failure behavior, examples, and
reload semantics are consolidated in
[Authentication and Secrets](/docs/configuration/authentication-and-secrets).
Control API authentication is a separate admin-plane policy; its endpoint and
role contract is documented in the
[Control API Reference](/docs/reference/control-api-reference).

## Logging Configuration

Controls logging output, verbosity, and destination.

### Properties

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `level` | string | No | `info` | Log level |
| `format` | string | No | `plain` | Output format: `plain` (human-readable) or `json` (structured) |
| `file.enabled` | bool | No | `false` | Write logs to a file instead of stderr |
| `file.path` | string | No | `/var/log/impulse/impulse.log` | Log file path (used when `file.enabled` is `true`) |

### Log Levels

Log levels in order of increasing verbosity:

- `off`: No logging output
- `error`: Error messages only
- `warn`: Warnings and errors
- `info`: Informational messages, warnings, and errors
- `debug`: Debug information
- `trace`: Trace-level debugging

### Examples

```yaml
# stderr only (default)
log:
  level: info
  format: plain

# Write to file
log:
  level: info
  format: plain
  file:
    enabled: true
    path: /var/log/impulse/impulse.log

# Structured JSON logs (recommended for log pipelines)
log:
  level: info
  format: json

# Development — debug to stderr
log:
  level: debug  # debug level
  format: plain

# Troubleshooting — trace to file
log:
  level: trace  # trace level
  format: json
  file:
    enabled: true
    path: /tmp/impulse-trace.log
```

### Operational Implications

- `log.level` reloads live, but log sink shape such as file output and format remains startup-owned.
- `json` is the safer default for production log pipelines.
- file logging adds local disk-management responsibility; stderr or journald avoids that at the cost of external collection requirements.

### Common Mistakes

- enabling file logging without rotation
- using trace-level logging for sustained production traffic
- assuming format changes apply through live runtime activation

## Performance Configuration

Controls resource limits, tuning knobs, and connection-flood protection. All fields are optional and fall back to sane defaults.

### Properties

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `worker_threads` | integer | No | `1` | Number of polling worker threads |
| `control_plane_threads` | integer | No | `2` | Tokio worker threads for the control-plane runtime (startup, health checks, metrics, and other async control tasks) |
| `reuseport` | bool | No | `true` | Enable `SO_REUSEPORT`; required when `worker_threads > 1` |
| `pin_workers` | bool | No | `false` | Pin each worker thread to a dedicated CPU core |
| `packet_shards_per_worker` | integer | No | `1` | Packet-processing shards per bound UDP worker socket; `1` preserves single-loop behavior, values >1 enable parallel shard workers |
| `packet_shard_queue_capacity` | integer | No | `2048` | Capacity of the bounded ingress queue per shard |
| `packet_shard_queue_max_bytes` | integer | No | `67108864` | Memory-aware cap (bytes) for queued datagram bytes per ingress shard dispatch queue |
| `global_inflight_limit` | integer | No | `4096` | Maximum concurrent in-flight requests across all upstreams |
| `per_upstream_inflight_limit` | integer | No | `1024` | Maximum concurrent in-flight requests per upstream pool |
| `per_backend_inflight_limit` | integer | No | `64` | Maximum concurrent in-flight requests per backend |
| `inflight_acquire_wait_ms` | integer | No | `0` | Optional micro-wait (ms) before shedding on global/upstream inflight permit acquisition; `0` sheds immediately |
| `backend_timeout_ms` | integer | No | `2000` | Initial backend response timeout (ms) |
| `backend_connect_timeout_ms` | integer | No | `500` | Backend TCP/TLS handshake timeout (ms); must be ≤ `backend_timeout_ms` |
| `backend_body_idle_timeout_ms` | integer | No | `2000` | Idle timeout while streaming response body (ms); must be ≥ `backend_timeout_ms` |
| `backend_body_total_timeout_ms` | integer | No | `30000` | Maximum wait for first upstream body bytes (ms); after body progress, idle timeout governs chunk pacing |
| `backend_total_request_timeout_ms` | integer | No | `35000` | Hard deadline for an entire request round-trip (ms); must be ≥ `backend_body_total_timeout_ms` |
| `shutdown_drain_timeout_ms` | integer | No | `5000` | Graceful-shutdown drain timeout in ms; active connections are force-closed once this deadline is reached |
| `udp_recv_buffer_bytes` | integer | No | `8388608` | UDP socket receive buffer size (bytes) |
| `udp_send_buffer_bytes` | integer | No | `8388608` | UDP socket send buffer size (bytes) |
| `h2_pool_max_idle_per_backend` | integer | No | `256` | Maximum idle HTTP/2 connections kept open per backend |
| `h2_pool_idle_timeout_ms` | integer | No | `90000` | How long an idle H2 connection is kept before being closed (ms) |
| `backend_dns_refresh_enabled` | bool | No | `false` | Enable periodic DNS refresh for hostname-based upstream backends |
| `backend_dns_refresh_interval_ms` | integer | No | `30000` | Control-plane DNS refresh interval for hostname-based upstream backends (ms) |
| `new_connections_per_sec` | integer | No | `2000` | Steady-state rate at which new QUIC connections are accepted (token-bucket refill, connections/sec) |
| `new_connections_burst` | integer | No | `500` | Burst capacity above the steady-state rate; the bucket starts full so the first burst of legitimate connections always succeeds |
| `max_active_connections` | integer | No | `20000` | Hard cap on active QUIC connections per worker; unknown `Initial` packets are dropped once this cap is reached |
| `quic_max_idle_timeout_ms` | integer | No | `5000` | QUIC idle timeout in ms; connection is closed after this period of inactivity |
| `quic_initial_max_data` | integer | No | `10000000` | Connection-level QUIC flow control window in bytes |
| `quic_initial_max_stream_data` | integer | No | `1000000` | Per-stream QUIC flow control window in bytes; must be ≤ `quic_initial_max_data` |
| `quic_initial_max_streams_bidi` | integer | No | `100` | Maximum concurrent bidirectional QUIC streams per connection |
| `quic_initial_max_streams_uni` | integer | No | `100` | Maximum concurrent unidirectional QUIC streams per connection |
| `max_response_body_bytes` | integer | No | `104857600` | Hard cap on upstream response body bytes per stream; streams exceeding this return 503 (`upstream response body too large`) |
| `max_request_body_bytes` | integer | No | `1000000` | Hard cap on request body bytes per stream; requests exceeding this are rejected with 413. Must be ≤ `quic_initial_max_stream_data` |
| `request_buffer_global_cap_bytes` | integer | No | `67108864` | Global cap (bytes) for data buffered in request backpressure queues across a worker |
| `unknown_length_response_prebuffer_bytes` | integer | No | `2097152` | Max bytes buffered for unknown-length upstream responses before headers are emitted; responses exceeding this are terminated with an overload response |
| `client_body_idle_timeout_ms` | integer | No | `10000` | Idle timeout (ms) for request-body upload progress; the stream is failed if no body bytes arrive within this period |

### Connection flood protection

`new_connections_per_sec` and `new_connections_burst` implement a token-bucket rate limiter on new QUIC connection accepts. The bucket starts full so legitimate burst traffic at startup is never penalised. Packets for **existing** connections are never affected by this limit — only unknown `Initial` packets that would create a new connection state entry are gated.

`max_active_connections` is a separate hard guardrail for total connection state. Use it to enforce deterministic memory limits under sustained handshake floods even when token-bucket limits allow temporary bursts.

```yaml
performance:
  new_connections_per_sec: 2000   # refill rate: 2 k new conns/sec
  new_connections_burst: 500      # allow a burst of up to 500 above the rate
  max_active_connections: 20000   # hard ceiling for concurrently tracked connections
```

Set `new_connections_burst` to `1` and `new_connections_per_sec` to a low value to aggressively throttle connection floods at the cost of rejecting legitimate concurrent handshakes.

### Examples

```yaml
# Single-worker, conservative limits
performance:
  worker_threads: 1
  global_inflight_limit: 1024
  new_connections_per_sec: 500
  new_connections_burst: 100

# High-throughput multi-worker setup
performance:
  worker_threads: 8
  reuseport: true
  pin_workers: true
  global_inflight_limit: 16384
  per_upstream_inflight_limit: 4096
  per_backend_inflight_limit: 256
  new_connections_per_sec: 10000
  new_connections_burst: 2000
```

### Operational Implications

- `worker_threads`, `reuseport`, and shard settings shape how ingress work spreads across cores.
- inflight limits, timeouts, and body caps define overload behavior as much as raw performance.
- DNS refresh and connection-pool settings affect how quickly backend changes are observed.

### Common Mistakes

- raising inflight limits without validating backend capacity and timeout posture
- setting very high body caps without thinking about memory pressure
- enabling aggressive multi-worker tuning before baseline observability is in place

## Resilience Configuration

`resilience` contains local overload protection, retry/hedge behavior, scoped
rate limits, distributed quota, protocol policy, and the worker watchdog.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `adaptive_admission` | object | No | object defaults | Dynamic local inflight ceiling. |
| `route_queue` | object | No | object defaults | Per-upstream and global concurrent admission caps. |
| `scoped_rate_limits` | array | No | `[]` | Per-instance token-bucket rules. |
| `quota` | object | No | object defaults | In-memory or Redis-backed quota contracts. |
| `protocol` | object | No | object defaults | Request-shape, early-data, and CONNECT policy. |
| `circuit_breaker` | object | No | object defaults | Per-backend failure isolation. |
| `hedging` | object | No | object defaults | Delayed speculative requests. |
| `retry_budget` | object | No | object defaults | Retry-amplification limits. |
| `brownout` | object | No | object defaults | Pressure-triggered non-core shedding. |
| `watchdog` | object | No | object defaults | Worker-health and restart policy. |

The exact fields, defaults, constraints, retry behavior, selector matrix,
quota failure semantics, and complete example are in
[Resilience, Rate Limits, and Quota](/docs/configuration/resilience). Redis
deployment and incident guidance is intentionally separate in
[Distributed Quota Operations](/docs/operations/distributed-quota).

## Observability and Control

`observability` configures the metrics listener, the HTTPS Control API,
OpenTelemetry tracing, and route-decision transparency. `security.privileges`
configures the post-bind Unix privilege drop.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `observability.metrics` | object | No | object defaults | Prometheus endpoint bind, path, connection limits, and remote-mTLS opt-in. |
| `observability.control_api` | object | No | object defaults | Administrative listener, paths, TLS client auth, bearer auth, RBAC, source policy, audit, and limits. |
| `observability.tracing` | object | No | object defaults | OTLP endpoint, service name, and sample ratio. |
| `observability.routing` | object | No | object defaults | Route-decision logging and transparency controls. |
| `security.privileges` | object | No | object defaults | Post-bind process user and group. |

The exact fields, defaults, constraints, complete security policy, and
privilege-dropping behavior are in
[Observability and Control Configuration](/docs/configuration/observability-and-control).
HTTP endpoint methods, payloads, responses, and status codes remain in the
[Control API Reference](/docs/reference/control-api-reference); metric names
and labels remain in the [Metrics Reference](/docs/reference/metrics-reference).

### Routing Transparency

`observability.routing` enables explicit route-decision logging.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | boolean | No | `false` | Emit route-decision transparency logs |
| `include_reason` | boolean | No | `true` | Include deterministic tie-break reason in route-decision logs |
| `expose_header` | boolean | No | `false` | Reserved toggle for downstream route-decision response headers |
| `header_name` | string | No | `"x-impulse-route-decision"` | Reserved header name; must be non-empty when `expose_header=true` |

### Watchdog Restart Hook

Use structured command execution:

- `resilience.watchdog.restart_command`: array, where index `0` is executable and remaining entries are arguments.

Legacy `resilience.watchdog.restart_hook` is deprecated and rejected by validation.

### Common Mistakes

- exposing the Control API on `0.0.0.0` for convenience
- assuming health and readiness endpoints are enough protection for admin-plane exposure
- using the legacy reload shortcut when staged validate/preview/activate flows are the safer operational path

## Configuration Validation

Impulse validates configuration at startup and reports errors before attempting to start the server.

### Common Validation Errors

1. **Missing required fields**
   - Neither `listen.tls.cert/key` nor `listen.tls.certificates` specified
   - Backend address or ID missing
   - Route configuration empty

2. **Invalid file paths**
   - TLS certificate file not found or not readable
   - TLS key file not found or not readable
   - Incorrect file permissions

3. **Invalid values**
   - Port number out of range (1-65535)
   - Invalid backend address format (accepted: `host:port`, `https://host:port`, `http://host:port`, or bare `host`; scheme-default port is inferred when omitted)
   - Backend weight outside `1`–`1000`

4. **Configuration conflicts**
   - Duplicate effective listener `(address, port)` values
   - Duplicate normalized route matchers
   - Duplicate normalized backend origins
   - Brownout `recover_inflight_percent` ≥ `trigger_inflight_percent`
   - `adaptive_admission.min_limit` set to 0
   - `retry_budget.ratio_percent` > 100
   - `hedging.enabled` with `delay_ms` = 0

### Testing Configuration

There is no validation-only CLI flag. Running Impulse with a valid configuration
continues into runtime initialization, binds the configured listeners, and keeps
the process running. It does not exit after validation.

Use one of these workflows instead:

1. **Controlled startup:** copy the candidate config to an isolated host or
   change every listener and observability bind to non-production addresses and
   ports. Start Impulse in the foreground, wait for its listening/ready log,
   then stop it with `Ctrl-C`.
2. **Staged Control API:** on a running instance, submit the same candidate to
   `POST /admin/runtime/validate`, then `/preview`, and finally `/activate` only
   after reviewing the returned plan and rejected changes. Validate and preview
   do not replace the active runtime; activate does.

Controlled-startup example:

```bash
impulse --config /etc/impulse/config-validation.yaml
```

An unreadable or invalid explicitly supplied configuration produces a fatal
startup error and exits with status `1`. A valid configuration has no automatic
success exit status because the server remains running; reaching the
listening/ready state is the success signal. Stop the isolated process after
that signal. A later bind or runtime-initialization failure is also a failed
startup, even if schema validation succeeded. If `--config` is omitted and the
default `/etc/impulse/config.yaml` does not exist, Impulse exits with status `2`.

For the staged workflow, do not treat HTTP status alone as the validation
result: `/admin/runtime/validate` can return `200` with rejected changes. Inspect
`candidate_status` and `rejected_changes` before previewing or activating. See
the [Control API Reference](/docs/reference/control-api-reference#post-adminruntimevalidate)
for request and response details.

## Complete examples

Use [Configuration Examples](/docs/configuration/examples) for complete
deployment files and
[Routing and Upstreams](/docs/configuration/routing-and-upstreams#canonical-example)
for the canonical routed backend-pool example.
