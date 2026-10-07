# Resilience, Rate Limits, and Quota

This is the focused Impulse v0.6 reference for `resilience`. The general
[Configuration Reference](/docs/configuration/reference) remains the schema
authority. Redis deployment and incident guidance belongs in
[Distributed Quota Operations](/docs/operations/distributed-quota); the quota
semantics that implementations must preserve are in the
[Quota Policy Contract](/docs/architecture/quota-policy-contract).

## Configuration Map

All `resilience` blocks are optional and reject unknown fields.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `adaptive_admission` | object | No | object defaults | Dynamic local inflight ceiling. |
| `route_queue` | object | No | object defaults | Per-upstream and global concurrent admission caps. |
| `scoped_rate_limits` | array | No | `[]` | Per-instance token-bucket rules. |
| `quota` | object | No | object defaults | In-memory or Redis-backed contract enforcement. |
| `protocol` | object | No | object defaults | Request-shape, 0-RTT, and CONNECT policy. |
| `circuit_breaker` | object | No | object defaults | Per-backend failure isolation. |
| `hedging` | object | No | object defaults | Delayed speculative request policy. |
| `retry_budget` | object | No | object defaults | Global and per-upstream retry-amplification limits. |
| `brownout` | object | No | object defaults | Pressure-triggered shedding for non-core upstreams. |
| `watchdog` | object | No | object defaults | Worker-health monitoring and controlled restart command. |

Quota and scoped rate limits enforce traffic contracts. Brownout, adaptive
admission, queues, inflight limits, and circuit breakers protect the local
runtime and backends. Keep those two concerns separate when interpreting a
rejection.

## Retries

There is no independent `retries` configuration block. Impulse may make at
most one retry after a primary upstream attempt fails. The retry uses a
different eligible backend and occurs only when all of these conditions hold:

- the failure is a timeout, transport failure, or retryable pool failure
- the method is idempotent: `GET`, `HEAD`, `PUT`, `DELETE`, `OPTIONS`, or `TRACE`
- the request is bodyless and therefore replayable
- the single-retry attempt limit has not been reached
- the retry budget admits the attempt
- an alternate healthy backend is available and is not excluded by selection

TLS, protocol, bridge, and pool-send failures are terminal. `POST`, `PATCH`,
requests with bodies, and tunnel requests are not retried. A circuit-open
primary failure may retry without consuming retry budget, but it still needs
an eligible alternate backend and must satisfy the other retry rules.

### Retry Budget

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `retry_budget.enabled` | boolean | No | `true` | Enforces retry-amplification limits. When false, retry eligibility still applies. |
| `retry_budget.ratio_percent` | integer | No | `10` | Global retry allowance as a percentage of observed primary attempts; range `0..=100`. |
| `retry_budget.per_route_ratio_percent` | map of string to integer | No | `{}` | Per-upstream-name overrides; every value must be `0..=100`. |

The runtime counts primary attempts globally and per selected upstream. Both
the global allowance and the selected upstream's allowance must admit a retry.
Each allowance is calculated as `floor(primary_count × ratio / 100) + 1`, so a
new runtime has one bootstrap retry slot. Counters are in memory and reset when
the resilience runtime is rebuilt or the process restarts.

## Hedging

Hedging sends a speculative request to a different eligible backend if the
primary remains incomplete after the configured delay.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `hedging.enabled` | boolean | No | `false` | Enables hedging. |
| `hedging.delay_ms` | integer | No | `100` | Delay before the speculative attempt; must be greater than zero when enabled. |
| `hedging.safe_methods` | array of strings | No | `["GET", "HEAD"]` | Case-insensitive methods eligible for hedging. |
| `hedging.route_allowlist` | array of strings | No | `[]` | Upstream pool names eligible for hedging; empty means every upstream. |

A hedge also requires a bodyless non-tunnel request, an alternate healthy
backend, and retry-budget capacity. Brownout suppresses hedging while active.
After the delay, the first successful response wins; if one attempt fails, the
other may still complete. Hedging consumes retry budget because it adds a
second upstream attempt.

## Circuit Breakers

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `circuit_breaker.enabled` | boolean | No | `true` | Enables breakers keyed by backend address. |
| `circuit_breaker.failure_threshold` | integer | No | `3` | Consecutive recorded failures that open a closed circuit; must be greater than zero. |
| `circuit_breaker.open_ms` | integer | No | `30000` | Time the circuit remains open before becoming half-open; must be greater than zero. |
| `circuit_breaker.half_open_max_probes` | integer | No | `1` | Concurrent probe permits in half-open state; must be greater than zero. |

A success closes the circuit and resets consecutive failures. A failed
half-open probe reopens it for `open_ms`; a successful probe closes it. Open
backends are not sent requests and alternate-backend selection may route around
them.

## Adaptive Admission and Brownout

### Adaptive Admission

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `adaptive_admission.enabled` | boolean | No | `true` | Enforces a dynamic local inflight ceiling. |
| `adaptive_admission.min_limit` | integer | No | `64` | Minimum dynamic limit; must be greater than zero. |
| `adaptive_admission.max_limit` | integer or `null` | No | `null` | Maximum dynamic limit; `null` uses `performance.global_inflight_limit`. |
| `adaptive_admission.decrease_step` | integer | No | `16` | Amount removed after a high-latency or overloaded observation; must be greater than zero. |
| `adaptive_admission.increase_step` | integer | No | `16` | Amount restored after a healthy observation; must be greater than zero. |
| `adaptive_admission.high_latency_ms` | integer | No | `500` | Latency at or above which the ceiling decreases. |

`max_limit` must be at least `min_limit` and no greater than
`performance.global_inflight_limit`. The runtime starts at the maximum, moves
toward the minimum on pressure, and recovers by `increase_step` on healthy
observations. Admission at the current ceiling returns overload rather than
quota denial.

### Brownout

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `brownout.enabled` | boolean | No | `true` | Enables pressure-triggered shedding. |
| `brownout.trigger_inflight_percent` | integer | No | `90` | Activates brownout at or above this adaptive-inflight percentage; range `0..=100`. |
| `brownout.recover_inflight_percent` | integer | No | `60` | Deactivates at or below this percentage; must be lower than the trigger. |
| `brownout.core_routes` | array of strings | No | `[]` | Top-level `upstream` pool names allowed while brownout is active. |

`core_routes` contains upstream pool names, not paths or backend IDs. An empty
list means every routed request is non-core and is shed during brownout. A shed
request receives `503 Service Unavailable` and the route-queue `Retry-After`
value. Brownout is evaluated after routing and before adaptive admission,
inflight permits, and backend circuit-breaker execution.

### Route Queue

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `route_queue.default_cap` | integer | No | `512` | Default concurrent permit cap per upstream; must be greater than zero. |
| `route_queue.global_cap` | integer | No | `2048` | Concurrent permit cap across upstreams; must be greater than zero. |
| `route_queue.shed_retry_after_seconds` | integer | No | `1` | `Retry-After` value for queue and brownout shedding; must be greater than zero. |
| `route_queue.caps` | map of string to integer | No | `{}` | Per-upstream-name caps; every value must be greater than zero. |

Despite the schema name, this limiter does not wait in a queue: permit
acquisition is immediate and a full cap sheds the request with 503.

## Scoped Rate Limits

`resilience.scoped_rate_limits` is a per-instance token-bucket limiter. Rules
are evaluated in configuration order; the first exhausted applicable rule
returns `429 Too Many Requests`. Counters are not shared across Impulse
instances.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `name` | string | Yes | — | Unique non-empty rule name. |
| `scope` | enum | Yes | — | `route`, `client`, `tenant`, or `token`. |
| `requests_per_sec` | integer | Yes | — | Token refill rate; must be greater than zero. |
| `burst` | integer | Yes | — | Bucket capacity; must be greater than zero. |
| `key` | string or `null` | Conditional | `null` | Request-key source. Forbidden for `route`, required for `tenant`, optional for `client` and `token`. |
| `route_allowlist` | array of strings | No | `[]` | Upstream pool names to which the rule applies; empty means all upstreams. |
| `idle_ttl_secs` | integer | No | `300` | Idle bucket lifetime; must be greater than zero. |

The default key is `peer_ip` for `client` and `bearer_token` for `token`.
`tenant` always requires an explicit configured key. For compatibility, if the
selected identity is missing, scoped rules fall back in order to authority,
path, then method.

Each rule keeps at most 1,024 live buckets. If a new bucket cannot be allocated,
the legacy scoped limiter fails open for that request. Non-route identity
components are SHA-256 hashed in storage keys. Rule names must be unique and
`route_allowlist` cannot contain empty values.

```yaml
resilience:
  scoped_rate_limits:
    - name: "tenant-api"
      scope: tenant
      key: "header:x-tenant-id"
      route_allowlist: ["api"]
      requests_per_sec: 50
      burst: 100
      idle_ttl_secs: 300
```

## Request-Key Sources and Selector Composition

Scoped rules accept all request-key sources below. Distributed quota narrows
them by selector dimension to prevent unrelated identities being mislabeled.

| Source | Syntax | Scoped limits | Quota `tenant` | Quota `token` | Quota `client` |
| --- | --- | --- | --- | --- | --- |
| Header | `header:<name>` | Yes | Yes | Yes | Yes |
| Cookie | `cookie:<name>` | Yes | Yes | Yes | Yes |
| Query parameter | `query:<name>` | Yes | Yes | Yes | Yes |
| Path | `path` | Yes | No | No | No |
| Authority | `authority` | Yes | No | No | No |
| Method | `method` | Yes | No | No | No |
| Connection ID | `cid` or `sticky-cid` | Yes | No | No | No |
| Peer/client IP | `peer_ip` or `client_ip` | Yes | No | No | Yes |
| Bearer token | `bearer_token` | Yes | Yes | Yes | No |

For distributed quota, `selector.route: true` adds the selected upstream pool
name. `tenant`, `token`, and `client` each contain a `{ key: "..." }` object.
At least one dimension is required, and the same normalized request-key source
cannot be reused for multiple identity dimensions in one selector.

The composite key has stable component order: policy, route, tenant, token,
client. Route stays readable; tenant, token, and client values are SHA-256
hashed before storage and are not exposed as raw metric labels. Every selected
dimension must resolve, and a request-derived value is limited to 256 bytes.
Missing or malformed data produces
`selector_identity_missing` or `selector_identity_invalid`; distributed quota
does not use the scoped limiter's legacy fallback.

## Distributed Quota Schema

### Quota Policy Set

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `quota.enabled` | boolean | No | `false` | Enables quota evaluation. At least one policy is required when true. |
| `quota.enforcement` | enum | No | `enforce` | `enforce` rejects denials; `shadow` records would-deny outcomes and admits traffic. |
| `quota.backend_failure_policy` | enum | No | `fail_closed` | `fail_open` admits or `fail_closed` rejects when backend evaluation fails. |
| `quota.backend` | tagged object | No | `{kind: in_memory, key_prefix: "impulse:quota"}` | Counter backend. |
| `quota.local_fallback` | object or `null` | No | `null` | Bounded per-instance fallback for Redis timeout/unavailability only. |
| `quota.policies` | array | No | `[]` | Ordered policy contracts. Names and selector/window contracts must be unique. |

Quota configuration is still validated when `enabled: false`; disabling
evaluation does not make malformed policies or backend settings acceptable.

### Counter Backends

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `backend.kind` | enum | Yes | `in_memory` in the default object | `in_memory` or `redis`. |
| `backend.key_prefix` | string | No | `"impulse:quota"` | Non-empty storage-key namespace. |
| `backend.url` | string | Redis only | — | Non-empty Redis URL. |
| `backend.connect_timeout_ms` | integer | Redis only | `250` | Redis connection timeout; must be greater than zero. |
| `backend.command_timeout_ms` | integer | Redis only | `100` | Per-evaluation command timeout; must be greater than zero. |
| `backend.max_inflight` | integer | Redis only | `1024` | Concurrent Redis evaluation cap; must be greater than zero. |

The in-memory backend is local to one process and has an internal cap of 4,096
active buckets. Redis evaluates configured windows atomically for one policy
and composite key.

### Local Fallback

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `local_fallback.key_prefix` | string | No | `"impulse:quota:fallback"` | Non-empty namespace for fallback counters. |
| `local_fallback.max_entries` | integer | Yes | — | Maximum local fallback buckets; must be greater than zero. |

`local_fallback` is valid only with `backend.kind: redis`. It is attempted for
`backend_timeout` and `backend_unavailable`, not `backend_error`. A successful
fallback decision is enforced normally but uses per-instance counters and is
reported with a degraded backend mode. If fallback also fails, the configured
backend-failure policy handles the combined failure.

### Policies and Windows

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `policies[].name` | string | Yes | — | Unique non-empty policy name. |
| `policies[].route_allowlist` | array of strings | No | `[]` | Upstream pool names matched by the policy; empty means all upstreams. |
| `policies[].selector` | object | No | `{}` | Composite selector; validation requires at least one dimension. |
| `policies[].selector.route` | boolean | No | `false` | Includes the selected upstream pool name. |
| `policies[].selector.tenant` | object or `null` | No | `null` | Tenant identity source. |
| `policies[].selector.token` | object or `null` | No | `null` | Token identity source. |
| `policies[].selector.client` | object or `null` | No | `null` | Client identity source. |
| `policies[].selector.<dimension>.key` | string | Conditional | — | Non-empty compatible request-key source from the matrix above. |
| `policies[].burst` | object or `null` | Conditional | `null` | Short-window contract. At least one window is required. |
| `policies[].sustained` | object or `null` | Conditional | `null` | Long-window contract. At least one window is required. |
| `<window>.requests` | integer | Yes | — | Allowed requests in the window; must be greater than zero. |
| `<window>.window_secs` | integer | Yes | — | Window duration in seconds; must be greater than zero. |

When both windows exist, `burst.window_secs` must be less than
`sustained.window_secs`. Both are checked as one backend decision; a request is
allowed only when every configured window permits it, and a denied decision
does not partially consume another window.

All policies whose route allowlist matches are evaluated in configuration
order. An enforced quota denial or fail-closed backend failure stops evaluation.
Otherwise, later matching policies also apply. In shadow mode, a would-deny is
recorded without rejecting the request.

Policy names and all `route_allowlist` values must be non-empty. Two policies
cannot have the same name or the same route-allowlist, selector, and window
contract, even if their names differ.

### Backend-Failure and Response Behavior

| Outcome | Enforcement | HTTP result |
| --- | --- | --- |
| Burst or sustained exhaustion | `enforce` | `429 Too Many Requests`, with `Retry-After` when a reset time is available |
| Missing or invalid selector identity | `enforce` | `429 Too Many Requests` |
| Any policy denial | `shadow` | Request admitted; would-deny outcome recorded |
| Backend timeout, unavailable, or error | `fail_open` | Request admitted; degraded outcome recorded |
| Backend timeout, unavailable, or error | `fail_closed` | `503 Service Unavailable` |

Canonical reasons are `burst_quota_exhausted`,
`sustained_quota_exhausted`, `selector_identity_missing`,
`selector_identity_invalid`, `backend_timeout`, `backend_unavailable`, and
`backend_error`.

```yaml
resilience:
  quota:
    enabled: true
    enforcement: enforce
    backend_failure_policy: fail_open
    backend:
      kind: redis
      url: "redis://<redis-host>:6379/0"
      key_prefix: "impulse:quota:<environment>"
      connect_timeout_ms: 250
      command_timeout_ms: 100
      max_inflight: 1024
    local_fallback:
      key_prefix: "impulse:quota:fallback:<environment>"
      max_entries: 50000
    policies:
      - name: "payments-by-tenant"
        route_allowlist: ["payments"]
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

## Protocol and Watchdog Fields

These fields share the `resilience` object even though they are not quota or
backend-retry policy.

### Protocol

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `protocol.allow_0rtt` | boolean | No | `false` | Accepts early data when all other 0-RTT checks pass. |
| `protocol.early_data_safe_methods` | array | No | `["GET", "HEAD"]` | Valid method tokens; only GET/HEAD are allowed when 0-RTT is enabled. |
| `protocol.max_headers_count` | integer | No | `128` | Maximum request-header count; must be greater than zero. |
| `protocol.max_headers_bytes` | integer | No | `16384` | Aggregate request-header bytes; must be greater than zero. |
| `protocol.enforce_authority_host_match` | boolean | No | `true` | Rejects differing `:authority` and `Host`. |
| `protocol.allow_connect` | boolean | No | `false` | Enables CONNECT handling. |
| `protocol.connect_allowed_ports` | array of integers | No | `[]` | Optional port allowlist; entries must be `1..=65535` and require CONNECT. |
| `protocol.connect_allowed_authorities` | array of strings | No | `[]` | Optional exact `host:port` allowlist; requires CONNECT. |
| `protocol.allowed_methods` | array of strings | No | `[]` | Valid method-token allowlist; empty permits all methods. |
| `protocol.denied_path_prefixes` | array of strings | No | `[]` | `/`-prefixed paths rejected with 403. |

### Watchdog

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `watchdog.enabled` | boolean | No | `false` | Enables worker-health evaluation. |
| `watchdog.check_interval_ms` | integer | No | `1000` | Evaluation interval. |
| `watchdog.poll_stall_timeout_ms` | integer | No | `5000` | Worker poll-stall threshold. |
| `watchdog.timeout_error_rate_percent` | integer | No | `60` | Timeout-rate threshold. |
| `watchdog.min_requests_per_window` | integer | No | `20` | Minimum sample size for rate evaluation. |
| `watchdog.overload_inflight_percent` | integer | No | `95` | Inflight pressure threshold. |
| `watchdog.unhealthy_consecutive_windows` | integer | No | `3` | Consecutive unhealthy windows before action. |
| `watchdog.drain_grace_ms` | integer | No | `8000` | Drain grace before restart command. |
| `watchdog.restart_cooldown_ms` | integer | No | `120000` | Minimum time between restart commands. |
| `watchdog.restart_command` | array of strings | No | `[]` | Executable followed by arguments; no shell evaluation. |
| `watchdog.restart_hook` | string or `null` | No | `null` | Deprecated; any configured value is rejected. |

All watchdog durations, sample counts, and consecutive-window counts must be
greater than zero. Percentage fields must be at most 100. A non-empty
`restart_command` must begin with an absolute, non-empty executable path. When
the watchdog is enabled, `drain_grace_ms` must be at least
`performance.shutdown_drain_timeout_ms`.

Resilience policy is runtime-generation-owned. Apply changes with the Control
API `validate → preview → activate` workflow; rollback restores the retained
generation's policy.

## Related Pages

- [Distributed Quota Operations](/docs/operations/distributed-quota)
- [Quota Policy Contract](/docs/architecture/quota-policy-contract)
- [Metrics Reference](/docs/reference/metrics-reference)
- [Operations Runbook](/docs/operations/runbook)
