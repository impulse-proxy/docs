# Operating Distributed Quota

This page covers Redis deployment, rollout, degraded modes, and incident
response for Impulse distributed quota. It intentionally does not duplicate
the schema. Use:

- [Resilience, Rate Limits, and Quota](/docs/configuration/resilience#distributed-quota-schema)
  for fields, defaults, constraints, and examples
- [Quota Policy Contract](/docs/architecture/quota-policy-contract) for stable
  selector, counter, response, and observability semantics
- [Metrics Reference](/docs/reference/metrics-reference#quota-metrics) for exact
  metric names and labels

## When Redis Is Appropriate

Use the Redis backend when a quota must be shared across multiple Impulse
instances. Keep `scoped_rate_limits` or the in-memory quota backend when the
counter is intentionally process-local and a Redis dependency would add no
value.

Distributed quota is contract enforcement, not overload protection. Keep local
adaptive admission, inflight caps, circuit breakers, queues, and brownout
configured independently.

## Redis Deployment Posture

- Place Redis close to the Impulse fleet; quota evaluation is on the request
  admission path.
- Use a dedicated deployment or logical database when quota load or failure
  isolation matters.
- Use a distinct key prefix for each environment and contract namespace.
- Restrict Redis network access and credentials to the Impulse deployment.
- Monitor memory, evictions, command latency, connection errors, and saturation
  of Impulse's Redis inflight cap.
- Synchronize clocks across Impulse instances. The proxy computes fixed-window
  boundaries from its local wall clock before the atomic Redis script runs.
- Treat Redis replication and multi-region lag as an explicit consistency
  tradeoff. Atomicity is per request, policy, and composite key on the Redis
  node executing the script.

Impulse stores a separate key per policy, selector, and window bucket. Keys
expire at the window boundary plus a small grace interval. A request with both
burst and sustained windows evaluates and updates them in one script call.

## Timeouts and Concurrency

Choose the connection timeout for the network path and the command timeout for
the latency your request admission path can tolerate. Tight timeouts detect an
incident quickly but can move healthy slow responses into fail-open,
fail-closed, or local fallback behavior. Loose timeouts consume request latency
and inflight capacity.

Set `max_inflight` to bound Redis work from each Impulse process. Size the Redis
deployment for the aggregate cap across the fleet, not the value from one
instance. Watch for `backend_timeout` and `backend_unavailable` while tuning;
raising the cap during Redis saturation usually amplifies the incident.

## Failure Posture

Choose the backend-failure policy as a product decision before rollout.

### Fail open

Use `fail_open` when temporary over-admission is preferable to application
unavailability. A backend timeout, unavailable backend, or evaluation error
admits the request and records a failed-open quota outcome. Local overload
controls continue to apply.

### Fail closed

Use `fail_closed` when contract strictness is more important than availability.
A backend failure returns `503 Service Unavailable`, with a quota backend reason
rather than an overload reason.

### Bounded local fallback

Local fallback is useful when an outage should retain approximate enforcement
without blocking all traffic. It is deliberately bounded and process-local:

- only Redis timeout and unavailable failures enter fallback
- protocol, script, and other backend errors bypass it
- each Impulse instance maintains independent fallback counters
- a successful fallback decision can still deny an exhausted policy
- fallback-capacity exhaustion returns to the configured fail-open or
  fail-closed behavior
- metrics and runtime state remain degraded while fallback is in use

Do not enable fallback unless per-instance divergence during an outage is
acceptable. Size `max_entries` for expected active selector/window buckets and
alert before it becomes the next failure boundary.

## Rollout Procedure

1. Define selectors and windows in a non-production candidate and confirm that
   route allowlists contain upstream pool names.
2. Activate the policy in `shadow` mode.
3. Confirm selector extraction does not produce unexpected missing/invalid
   outcomes or unbounded policy cardinality.
4. Confirm `GET /admin/runtime` reports the intended backend and policy set.
5. Observe Redis latency, quota backend health, and would-deny decisions under
   representative traffic.
6. Exercise Redis timeout and unavailable scenarios and verify the chosen
   fail-open, fail-closed, and fallback behavior.
7. Switch to `enforce` through `validate → preview → activate`.
8. Watch quota outcomes and application error budgets before expanding the
   rollout.

Use a new key prefix when a rollout must start with empty counters. Reusing a
prefix intentionally preserves the active fixed-window namespace.

## Migrating Scoped Rate Limits

Scoped rate limits and distributed quota have different missing-key and counter
semantics, so migrate by observed behavior rather than translating fields
blindly.

1. Recreate the rule as a quota policy in `shadow` mode.
2. Make implicit scoped defaults explicit. Typical mappings are route to
   `selector.route`, token to `bearer_token`, and client to `client_ip` or
   `peer_ip`.
3. Account for the difference that scoped rules use a legacy authority/path/
   method fallback when their identity is missing; distributed quota reports an
   explicit missing selector instead.
4. Compare shadow outcomes with scoped-rate-limit metrics.
5. Enable quota enforcement.
6. Remove the scoped rule only after the enforced outcomes match the intended
   contract.

## Incident Triage

### Rising 429 responses

1. Check `impulse_quota_policy_outcomes_total` by policy and reason.
2. Distinguish burst/sustained exhaustion from missing or invalid selectors.
3. Confirm the policy and selector dimensions in `GET /admin/runtime`.
4. Determine whether traffic growth, abuse, an identity-source change, or an
   incorrectly sized contract caused the increase.

Do not widen adaptive admission or inflight limits to address quota exhaustion.

### Quota-related 503 responses

1. Confirm `decision="failed_closed"` and inspect the backend reason.
2. Check `impulse_quota_backend_health_total` and the runtime quota backend
   health summary.
3. Correlate Redis command latency, connection errors, availability, memory,
   and evictions.
4. Check whether `max_inflight` is saturated.
5. Restore Redis or intentionally activate a reviewed fail-open/fallback
   candidate. Do not silently change failure posture during diagnosis.

Not every 503 is quota. Brownout, inflight shedding, backend timeout, and other
overload or transport paths also return 503; use the reason and subsystem
metrics before acting.

### Fallback is active

Fallback keeps traffic moving but is an incident state:

1. Confirm a fallback-flavored `backend_mode` and degraded runtime state.
2. Restore primary Redis connectivity before local stores approach capacity.
3. Expect counters to diverge across instances during the outage.
4. After recovery, confirm decisions return to `backend_mode="redis"` and
   backend health observations become successful.

## Operator Signals

Primary signals:

- `impulse_quota_policy_outcomes_total{policy,decision,reason,selector_dimensions,backend_mode}`
- `impulse_quota_backend_health_total{backend_mode,reason}`
- `GET /admin/runtime` quota policy and backend-health summaries

Alert immediately on failed-open, failed-closed, or fallback backend modes.
Quota exhaustion may be expected contract behavior; alert on it relative to the
policy's expected traffic rather than treating every 429 as an infrastructure
failure.

## Related Pages

- [Resilience, Rate Limits, and Quota](/docs/configuration/resilience)
- [Quota Policy Contract](/docs/architecture/quota-policy-contract)
- [Failure Modes](/docs/operations/failure-modes)
- [Runbook](/docs/operations/runbook)
