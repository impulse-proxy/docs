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

For distributed quota policy examples, Redis backend posture, migration from
legacy scoped rate limiting, and operator interpretation, see
[Distributed Quota](/docs/operations/distributed-quota).

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
| `upstream_tls` | object | No | `{}` | Global TLS policy inherited by upstreams that omit `tls`. |
| `secrets` | object | No | `{}` | Secret-provider configuration. |
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

## Routing and Upstreams

The top-level `upstream` map defines routes, backend pools, per-upstream
policies, and load balancing. Each entry requires a `route` and a non-empty
`backends` array. Per-upstream load balancing defaults to `round-robin`.

Exact host, path, method, wildcard, precedence, backend, health-check,
request-key, strategy-alias, and weight semantics are consolidated in
[Routing and Upstreams](/docs/configuration/routing-and-upstreams). Use
[Load Balancing](/docs/user-guide/load-balancing) for strategy-selection
guidance.

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

Controls retry budgets, circuit breaking, hedging, adaptive admission, brownout shedding, route queuing, protocol policy, and the worker watchdog. All fields are optional and fall back to production-tuned defaults.

Use this section when you need to decide:

- how Impulse protects itself and its backends under pressure
- which retry and hedge behaviors are allowed
- what request-shape rules are enforced before backend execution

### adaptive_admission

Dynamically adjusts the global in-flight request limit based on observed backend latency.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | bool | No | `true` | Enable adaptive admission control |
| `min_limit` | integer | No | `64` | Floor for the dynamic in-flight limit; must be > 0 |
| `max_limit` | integer | No | `performance.global_inflight_limit` | Optional ceiling for the adaptive in-flight limit; must be `>= min_limit` and `<= performance.global_inflight_limit` |
| `decrease_step` | integer | No | `16` | Amount to subtract from the limit on high-latency observation |
| `increase_step` | integer | No | `16` | Amount to add to the limit on healthy-latency observation |
| `high_latency_ms` | integer | No | `500` | Latency threshold (ms) above which the limit is decreased |

### circuit_breaker

Tracks consecutive failures per backend and opens the circuit to stop sending requests to a failing backend.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | bool | No | `true` | Enable per-backend circuit breakers |
| `failure_threshold` | integer | No | `3` | Consecutive failures before opening the circuit |
| `open_ms` | integer | No | `30000` | How long (ms) the circuit stays open before probing |
| `half_open_max_probes` | integer | No | `1` | Probe requests allowed during half-open state |

### retry_budget

Limits retried requests as a fraction of primary requests to prevent retry amplification.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | bool | No | `true` | Enable retry budget enforcement |
| `ratio_percent` | integer | No | `10` | Max retries as a percentage of primary requests (0–100) |
| `per_route_ratio_percent` | map | No | `{}` | Per-route overrides: `{ "/api": 5 }` |

### hedging

Fires a speculative second request to an alternate backend when the primary is slow.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | bool | No | `false` | Enable request hedging |
| `delay_ms` | integer | No | `100` | Delay (ms) before firing the hedge; must be > 0 when `enabled` is true |
| `safe_methods` | list | No | `["GET","HEAD"]` | HTTP methods eligible for hedging |
| `route_allowlist` | list | No | `[]` | Routes eligible for hedging; empty means all routes |

### brownout

Brownout is a load-shedding mode that activates when the proxy is near capacity. When active, every incoming request whose upstream pool is **not** in `core_routes` is immediately rejected with `503 Service Unavailable` and a `Retry-After` header. Requests on core routes continue to be processed normally.

**How it works**

1. After each request is routed, Impulse samples the current global in-flight percent (active requests ÷ global limit × 100).
2. If the sample reaches `trigger_inflight_percent`, brownout activates.
3. Brownout stays active until the sample falls to or below `recover_inflight_percent`. The gap between the two thresholds is **hysteresis** — it prevents rapid oscillation when load is right at the boundary.
4. While active, `impulse_brownout_active` gauge is `1` and `impulse_overload_shed_by_reason_total{reason="brownout"}` increments for every shed request.

**Choosing `core_routes`**

`core_routes` is a list of pool names: the keys directly under the top-level
`upstream` map. It does not use backend `id` values. Routes whose selected
upstream name is absent from this list are shed during brownout.

- If `core_routes` is empty (the default), **all routes** are shed during brownout. This is safe but means brownout effectively becomes a full-stop — no requests get through.
- List only the routes that must keep working during a partial outage: authentication, payments, health checks. Avoid listing high-volume non-critical routes or you defeat the purpose of shedding.
- A route shed during brownout receives a `503` with the body `brownout active, non-core route shed` and a `Retry-After` hint. Clients that respect `Retry-After` will back off automatically.

**Interaction with other overload mechanisms**

Brownout runs after routing but before adaptive admission and circuit breakers. The order is:

1. **Brownout** — shed non-core routes immediately (no backend resource consumed)
2. **Adaptive admission** — dynamically cap total in-flight based on observed latency
3. **Per-upstream / per-backend inflight limits** — static caps per pool and backend
4. **Circuit breaker** — stop sending to a specific failing backend

If brownout is active and shedding load, adaptive admission will also begin to recover (inflight drops → limit rises). Once the in-flight percent falls to `recover_inflight_percent`, brownout deactivates and full traffic resumes. Set `recover_inflight_percent` at least 20–30 points below `trigger_inflight_percent` to give the system time to recover before re-admitting full traffic.

**Alerting**

Alert on `impulse_brownout_active == 1` for more than a brief window — sustained brownout means backends are under-provisioned or a downstream dependency is slow:

```yaml
- alert: ImpulseBrownoutActive
  expr: impulse_brownout_active == 1
  for: 30s
  labels:
    severity: warning
  annotations:
    summary: "Impulse brownout active on {{ $labels.instance }}"
    description: "Non-core routes are being shed. Check backend latency and inflight metrics."
```

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | bool | No | `true` | Enable brownout shedding |
| `trigger_inflight_percent` | integer | No | `90` | Inflight % at which brownout activates (0–100) |
| `recover_inflight_percent` | integer | No | `60` | Inflight % at which brownout deactivates; must be `< trigger_inflight_percent` |
| `core_routes` | list | No | `[]` | Keys from the top-level `upstream` map that are exempt from shedding; empty means all routes are shed. |

### route_queue

Per-route and global caps on queued (waiting) requests.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `default_cap` | integer | No | `512` | Per-route queue depth cap |
| `global_cap` | integer | No | `2048` | Total queue depth cap across all routes |
| `shed_retry_after_seconds` | integer | No | `1` | `Retry-After` header value (seconds) sent with 503 queue-shed responses |
| `caps` | map | No | `{}` | Per-route overrides: `{ "/api": 128 }` |

### protocol

Request validation and early-data policy.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `allow_0rtt` | bool | No | `false` | Accept 0-RTT early data |
| `early_data_safe_methods` | list | No | `["GET","HEAD"]` | Methods permitted in 0-RTT early data |
| `max_headers_count` | integer | No | `128` | Maximum number of request headers |
| `max_headers_bytes` | integer | No | `16384` | Maximum total size of request headers (bytes) |
| `enforce_authority_host_match` | bool | No | `true` | Reject requests where `:authority` differs from `Host` |
| `allow_connect` | bool | No | `false` | Enable CONNECT proxy tunneling |
| `connect_allowed_ports` | list | No | `[]` | Optional CONNECT target port allowlist |
| `connect_allowed_authorities` | list | No | `[]` | Optional exact CONNECT `host:port` allowlist |
| `allowed_methods` | list | No | `[]` | Allowed HTTP methods; empty means all methods allowed |
| `denied_path_prefixes` | list | No | `[]` | Path prefixes that are always rejected with 403 |

Request-shape rules enforced by the runtime:

- HTTP/3 requests are rejected when `:authority` and `Host` differ and `enforce_authority_host_match` is enabled.
- `CONNECT` requires `:authority`/`Host` in `host:port` form and must also satisfy the CONNECT allowlists when enabled.
- Native HTTP/3 ingress rejects `Upgrade` / `Connection: upgrade` style requests. WebSocket-style upgrades are only supported on the bootstrap HTTP/1.1 compatibility path, not on native H3.
- `HEAD` responses terminate after headers even if the upstream attempted to send a body.

### watchdog

Monitors worker health and triggers a restart command when error rates or stall conditions exceed thresholds.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `enabled` | bool | No | `false` | Enable the worker watchdog |
| `check_interval_ms` | integer | No | `1000` | How often (ms) the watchdog evaluates metrics |
| `poll_stall_timeout_ms` | integer | No | `5000` | Declare a stall if the event loop hasn't polled within this window |
| `timeout_error_rate_percent` | integer | No | `60` | Trigger if timeout errors exceed this % of requests in a window |
| `min_requests_per_window` | integer | No | `20` | Minimum requests in a window before error-rate check applies |
| `overload_inflight_percent` | integer | No | `95` | Trigger if in-flight % exceeds this threshold |
| `unhealthy_consecutive_windows` | integer | No | `3` | Consecutive unhealthy windows before invoking the restart command |
| `drain_grace_ms` | integer | No | `8000` | Grace period (ms) to drain connections before restarting |
| `restart_cooldown_ms` | integer | No | `120000` | Minimum time (ms) between restart command invocations |
| `restart_command` | list of strings | No | `[]` | Command invoked on restart trigger; first element is the executable, the rest are args. Avoids shell evaluation. |
| `restart_hook` | string | No | `null` | **Deprecated and rejected at startup** — setting it is a hard config error. Use `restart_command` instead. |

### Startup Validation Errors

The following resilience configurations are rejected at startup with a descriptive error:

| Condition | Error |
|-----------|-------|
| `recover_inflight_percent >= trigger_inflight_percent` | brownout hysteresis inverted |
| `adaptive_admission.min_limit == 0` | min_limit must be > 0 |
| `adaptive_admission.max_limit == 0` | max_limit must be > 0 when provided |
| `adaptive_admission.max_limit < adaptive_admission.min_limit` | max_limit must be >= min_limit |
| `adaptive_admission.max_limit > performance.global_inflight_limit` | max_limit must be `<= global_inflight_limit` |
| `retry_budget.ratio_percent > 100` | ratio_percent must be 0–100 |
| `hedging.enabled && delay_ms == 0` | delay_ms must be > 0 when hedging is enabled |

### Example

```yaml
resilience:
  adaptive_admission:
    enabled: true
    min_limit: 64
    max_limit: 4096
    high_latency_ms: 500

  circuit_breaker:
    enabled: true
    failure_threshold: 3
    open_ms: 30000
    half_open_max_probes: 1

  retry_budget:
    enabled: true
    ratio_percent: 10

  hedging:
    enabled: false
    delay_ms: 100

  brownout:
    enabled: true
    trigger_inflight_percent: 90
    recover_inflight_percent: 60
    core_routes:
      - "auth_pool"
      - "payments_pool"
```

### Operational Implications

- `adaptive_admission`, `brownout`, `route_queue`, and inflight caps interact as one overload-control surface.
- retry, hedging, and circuit breaking can protect latency or amplify backend pressure depending on how they are tuned.
- quota and scoped rate limiting are policy-contract features; they should not be interpreted as overload behavior.

### Common Mistakes

- leaving `brownout.core_routes` empty and unintentionally shedding all routes during brownout
- enabling hedging without understanding replay safety and backend amplification
- treating retry budgets as a substitute for backend reliability work
- mixing quota expectations with overload tuning

## Observability Endpoint Hardening

When enabling `observability.metrics` or `observability.control_api`, keep endpoints on loopback unless you intentionally expose them behind network controls.

Use this section when you need to decide:

- where metrics and the Control API should bind
- how much runtime control to expose
- how strongly the admin surface must be protected

### Metrics Endpoint

Key fields:

- `observability.metrics.address` (default: `127.0.0.1`): bind address. Non-loopback addresses are rejected unless `allow_non_loopback` is explicitly enabled.
- `observability.metrics.allow_non_loopback` (default: `false`): explicit opt-in for remote scraping. It requires `observability.control_api.tls.client_auth.mode=required`; the metrics endpoint then uses the primary listener certificate and the configured control-plane CA for mTLS.
- `observability.metrics.max_connections` (default: `512`): concurrent connection cap.
- `observability.metrics.connection_timeout_ms` (default: `30000`): per-connection lifetime timeout.

### Control API Endpoint

Key fields:

- `observability.control_api.auth_token`: bearer token required for runtime, reload, reload-certs, and restart endpoints (`Authorization: Bearer <token>`).
- `observability.control_api.reload_path` (default: `/admin/runtime/reload`): authenticated POST endpoint that re-reads the config file and applies the full configuration via an atomic runtime swap (routes, upstreams, backends, timeouts, limits, resilience policies). Startup-owned settings and listener bind/removal changes are rejected and still require a restart.
- `observability.control_api.reload_certs_path`: authenticated POST endpoint that reloads listener certificate and client-auth CA material for new handshakes.
- `observability.control_api.max_connections` (default: `256`): concurrent connection cap.
- `observability.control_api.connection_timeout_ms` (default: `30000`): per-connection lifetime timeout.

If `observability.control_api.address` is non-loopback, `observability.control_api.auth_token` is required.

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
