# Distributed Quota Policy Contract

This page defines the behavior that Impulse v0.6 preserves across configuration,
counter backends, admission responses, metrics, and Control API state. Use
[Resilience, Rate Limits, and Quota](/docs/configuration/resilience) for the
exact schema and [Distributed Quota Operations](/docs/operations/distributed-quota)
for Redis deployment and incident handling.

## Quota Is Not Overload

Quota enforces an abuse-control or commercial traffic contract. Overload
control protects the local proxy and backend fleet from resource pressure.
Impulse keeps them separate:

- quota exhaustion is not recorded as overload
- quota-backend failure is not recorded as overload
- overload shedding continues when the quota backend is unavailable
- quota and overload use separate reason and metric vocabularies

## Policy Matching

Quota runs after routing, so the `route` identity is the selected upstream pool
name. A policy applies when its `route_allowlist` is empty or contains that
name. Every applicable policy is evaluated in configuration order.

An enforced denial or fail-closed backend failure stops evaluation. Otherwise,
later matching policies also apply. This means multiple policies can constrain
one request; they are not alternatives selected by policy name.

## Selector Contract

A policy selector contains one or more of these dimensions:

- `route`: selected upstream pool name
- `tenant`: configured tenant identity source
- `token`: configured token identity source
- `client`: configured client identity source

Composite selectors are one counter identity, not a sequence of independent
checks. Impulse constructs components in stable `policy → route → tenant →
token → client` order. Length-prefixing prevents ambiguous concatenation.

Selector extraction has these invariants:

1. Every selected dimension must resolve for the policy to be evaluated.
2. A missing source yields `selector_identity_missing`.
3. A present but malformed or oversized source yields
   `selector_identity_invalid`.
4. The same normalized request-key source cannot populate multiple identity
   dimensions in one selector.
5. Route values remain readable; tenant, token, and client values are SHA-256
   hashed before entering storage keys or bounded-cardinality telemetry.
6. Distributed quota never silently substitutes an `unknown` identity and
   does not use the legacy fallback behavior of scoped rate limits.

The exact source compatibility matrix is in
[Selector Composition](/docs/configuration/resilience#request-key-sources-and-selector-composition).

## Window Contract

A policy defines `burst`, `sustained`, or both over the same composite key.
Both counters use fixed windows.

- `burst` is the shorter spike-control window
- `sustained` is the longer fairness or contract window
- when both exist, the burst duration must be shorter
- a request costs one unit
- the request is allowed only when every configured window allows it
- evaluation and update of all windows for one request are atomic
- a denied request does not partially consume another window

The in-memory backend performs the decision under its per-key counter state.
The Redis backend performs the combined decision in one atomic script. Impulse
computes fixed-window boundaries from the proxy process wall clock and passes
them to that script, so fleet clock synchronization is part of the deployment
contract.

Atomicity is per policy and composite key. Impulse does not promise a globally
serializable ledger across unrelated keys or regions; Redis topology and
replication choices determine cross-region behavior.

## Enforcement Contract

`enforcement: enforce` applies policy decisions. Exhausted windows and missing
or invalid selectors return `429 Too Many Requests`. An exhausted window adds
`Retry-After` when its reset time is known.

`enforcement: shadow` evaluates and records the same decisions but does not
reject the request. Shadow mode does not turn off counter evaluation.

Canonical policy-denial reasons are:

- `burst_quota_exhausted`
- `sustained_quota_exhausted`
- `selector_identity_missing`
- `selector_identity_invalid`

## Backend-Failure Contract

Counter-backend failures have three canonical reasons:

- `backend_timeout`
- `backend_unavailable`
- `backend_error`

`backend_failure_policy: fail_open` admits the request and records a degraded
quota outcome. `fail_closed` rejects it with `503 Service Unavailable`. Neither
result is an overload decision.

An explicitly configured Redis local fallback is tried before fail-open or
fail-closed handling, and only for timeout or unavailable failures. A fallback
decision uses bounded per-instance counters and the same policy windows. It is
reported with a degraded backend mode so operators can distinguish it from a
healthy Redis decision. Protocol, script, and other backend errors do not enter
fallback.

## Counter and Capacity Contract

- The default `in_memory` backend is process-local and bounded to 4,096 active
  buckets.
- Redis concurrency is bounded by `backend.max_inflight`.
- Local fallback capacity is bounded by `local_fallback.max_entries`.
- Capacity exhaustion is a backend-unavailable condition and follows the
  configured backend-failure policy when no usable fallback remains.
- Key prefixes isolate environments and policy deployments; changing a prefix
  starts a distinct counter namespace.

## Operator-Visible Contract

The runtime exposes the configured policies, intended backend, availability,
degraded state, failure mode, and recent backend errors. The stable metric
families are:

- `impulse_quota_policy_outcomes_total{policy,decision,reason,selector_dimensions,backend_mode}`
- `impulse_quota_backend_health_total{backend_mode,reason}`

The decision vocabulary distinguishes allowed, denied, shadow-denied,
failed-open, and failed-closed outcomes. Backend mode distinguishes healthy
in-memory or Redis decisions from Redis local-fallback decisions.

These distinctions are part of the contract: a dashboard or log pipeline must
not collapse quota exhaustion, quota dependency failure, and overload shedding
into one generic rejection category.

## Compatibility Boundary

The current contract intentionally supports only route, tenant, token, and
client dimensions, and only burst and sustained windows. Adding a selector
dimension, window type, deny reason, or backend protocol version requires an
explicit contract and observability update.
