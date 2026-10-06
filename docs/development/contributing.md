# Contributor Guide

This page is the concise orientation for contributors changing Impulse. It
records durable ownership boundaries, invariants, test expectations, benchmark
policy, and the feature-completion checklist. Detailed setup, branch, commit,
pull-request, and CI instructions belong to the
[Impulse contribution guide](https://github.com/impulse-proxy/impulse/blob/master/CONTRIBUTING.md).

## Repository Boundary

The code and documentation are maintained in separate repositories:

| Repository | Owns |
| --- | --- |
| [`impulse-proxy/impulse`](https://github.com/impulse-proxy/impulse) | Rust workspace, tests, benchmarks, packaging, and the detailed contribution workflow |
| [`impulse-proxy/docs`](https://github.com/impulse-proxy/docs) | Docusaurus product documentation and documentation-site configuration |

Every source, test, benchmark, and packaging path below is relative to an
**Impulse repository checkout**, not this documentation repository. Run Rust
commands there. Make product-documentation changes here and coordinate code and
documentation pull requests when a feature changes public behavior.

The current code and CI configuration are authoritative when a command or path
differs from this orientation page. Do not reproduce the contribution workflow
in the docs repository; update the Impulse repository's `CONTRIBUTING.md`
instead.

## Current Crate Map

| Impulse path | Responsibility |
| --- | --- |
| `impulse/` | CLI, startup sequencing, listener-group supervision, signals, drain, and process exit |
| `crates/config/` | Public YAML model, loading, validation, bounded secret/file resolution, and normalized runtime configuration |
| `crates/edge/` | Ingress adapters, request orchestration, routing, admission, resilience, runtime generations, backend lifecycle, metrics, Control API integration, and watchdog |
| `crates/bridge/` | Canonical upstream request shaping, forwarded-header policy, response normalization, and WebSocket/upgrade helpers |
| `crates/transport/` | Runtime-selected HTTP/1.1 and HTTP/2 backend clients, pooling, TLS, DNS-aware connection establishment, and client rotation |
| `crates/lb/` | Balancing algorithms, upstream-pool selection, health flags, and per-pool request accounting |
| `crates/utils/` | Shared TLS and logging utilities |
| `crates/errors/` | Cross-crate error and retry/hedge classification types |
| `packaging/` | Container, Debian, and systemd packaging assets |

Use the narrowest owner that can implement a change:

- raw configuration structs live under `crates/config/src/config/`
- validation lives under `crates/config/src/validator/`
- normalized runtime projection lives under `crates/config/src/runtime/`
- protocol-neutral request contracts live under `crates/edge/src/request_pipeline/`
- native and bootstrap ingress orchestration lives under `crates/edge/src/quic_listener/`
- routing lives under `crates/edge/src/routing/`
- generations and backend lifecycle live under `crates/edge/src/runtime/`
- request/response translation belongs to `crates/bridge/`
- backend protocol execution belongs to `crates/transport/`
- selection algorithms belong to `crates/lb/`

The [Architecture Overview](/docs/architecture/overview) and its focused pages
describe request flow and runtime ownership. Inspect current crate façades and
call sites before changing visibility; a manually maintained public-API
inventory is intentionally not part of the documentation.

## Core Invariants

### Routing and request policy

- Route selection is deterministic: longer path prefix wins first, followed by
  host-specific over host-agnostic, exact host over wildcard, longer wildcard
  suffix, method-specific over any-method, and finally upstream name.
- Ambiguous routes after normalization are rejected instead of depending on
  declaration or hash-map order.
- Native QUIC and bootstrap ingress use the same active request policy,
  routing, backend selection, transport, and outcome semantics.
- Transport executes the already-selected backend protocol; it does not own
  routing, admission, retry policy, or durable health state.

### Runtime and resource ownership

- Activation publishes one completely prepared runtime generation or leaves
  the previous generation active; request workers must not observe a partial
  swap.
- Listener-local state is not an alternate source of truth for active runtime
  configuration.
- Every terminal stream path releases inflight, buffering, queue, and other
  resource reservations exactly once.
- Connection IDs and aliases resolve to one primary connection, and teardown
  removes aliases without orphaning connection state.
- Drain stops new work while allowing admitted work to finish until the
  configured boundary; forced teardown must remain bounded.

### Backends, control, and secrets

- HTTP health classification treats 2xx/3xx as success, 4xx as neutral, and
  5xx as failure; timeout and transport failures are also unhealthy signals
  subject to configured thresholds and cooldowns.
- `http://` backends use HTTP/1.1 and `https://` or schemeless secure backends
  use HTTP/2; downstream protocol does not select the backend protocol.
- Listener certificate reload is not configuration activation, and upstream
  TLS material remains generation-owned.
- Control-plane services observe the canonical runtime and must not become
  alternate owners of request-path state.
- Runtime views, metrics, logs, traces, and audit records must not expose raw
  secret values or private-key material.

When an implementation requires breaking an invariant, treat that as an
architecture change: update the relevant architecture/reference contract and
make the compatibility and migration impact explicit.

## Testing Expectations

Use the Impulse repository's contribution guide and current CI workflow for the
exact required commands. The expected coverage shape is:

- Add unit tests beside local parsing, validation, data-structure, selection,
  classification, and rendering logic.
- Add crate integration tests for behavior visible across a public crate
  boundary.
- Add `crates/edge/tests/` coverage for end-to-end request behavior, including
  native/bootstrap parity when both ingress paths are affected.
- Cover rejection and cleanup paths, not only success: malformed input,
  timeouts, resets, drains, activation failure, and resource release.
- Add configuration tests for accepted syntax, defaults, normalization,
  invalid combinations, and runtime lowering when the schema changes.
- Assert metrics, runtime views, logs/audit classification, or other operator
  signals when observable behavior changes.
- Add regression coverage for every fixed externally visible defect.

Long-running soak, chaos, interoperability, fuzzing, or capacity work may live
outside the ordinary unit/integration loop, but it must be identified in the
pull request when it is necessary to justify safety or performance.

## Benchmarking Policy

Criterion microbenchmarks are focused local investigation tools:

| Benchmark | Command from the Impulse repository | Scope |
| --- | --- | --- |
| `crates/edge/benches/route_index.rs` | `cargo bench -p impulse-edge --bench route_index` | Route-index construction and lookup |
| `crates/lb/benches/load_balancing.rs` | `cargo bench -p impulse-lb --bench load_balancing` | Pool construction and backend selection |

The equivalent Make targets are `bench-route-index` and
`bench-load-balancing`. Benchmarks are opt-in and are not CI gates. Keep fixture
construction outside timed loops, compare before/after results on equivalent
hardware and toolchains, record the environment and variance, and use results
to explain a focused change. Do not turn one local microbenchmark into a
universal throughput or latency claim.

Add or extend a benchmark only when a change materially affects a hot path and
the benchmark measures that path without setup noise. Production capacity
claims require representative end-to-end testing, not Criterion alone.

## Feature-Addition Checklist

- [ ] Identify the owning crate and keep the change behind its narrowest existing façade.
- [ ] Define externally visible behavior, failure semantics, compatibility, and rollout impact before implementation.
- [ ] If configurable, update the raw schema, defaults, validation, normalized runtime projection, and generation-change classification together.
- [ ] Preserve the invariants above across both native and bootstrap ingress where applicable.
- [ ] Add unit, integration, parity, regression, and observable-signal assertions in proportion to the change.
- [ ] Benchmark material hot-path changes under the policy above; otherwise do not add ceremonial benchmarks.
- [ ] Update the canonical configuration, Control API, metrics, or status-and-limitations reference affected by the change.
- [ ] Keep public crate visibility deliberate; do not widen a façade only to avoid placing code in its owner.
- [ ] Follow the Impulse contribution guide for formatting, linting, test commands, commits, and pull-request workflow.

## Related Pages

- [Impulse Contribution Guide](https://github.com/impulse-proxy/impulse/blob/master/CONTRIBUTING.md)
- [Architecture Overview](/docs/architecture/overview)
- [Request Lifecycle](/docs/architecture/request-lifecycle)
- [Runtime Generation and Configuration Lifecycle](/docs/architecture/runtime-generation)
- [Transport and Backend Lifecycle](/docs/architecture/transport-and-backend-lifecycle)
