# Load Balancing

Use this guide to choose an upstream load-balancing strategy. For exact route
matching, accepted strategy aliases, request-key extraction, backend fields,
and validation constraints, use
[Routing and Upstreams](/docs/configuration/routing-and-upstreams).

## Choose a strategy

| Workload | Recommended strategy | Why |
| -------- | -------------------- | --- |
| General stateless service | `round-robin` | Predictable distribution and the default behavior. |
| Stateless service where random sampling is preferred | `random` | No affinity and weighted probabilistic selection. |
| Session or cache affinity based on request data | `consistent-hash` | Stable placement from a header, cookie, query parameter, or another request key. |
| Requests have widely different durations | `least-connections` | Chooses the backend with the fewest active requests. |
| Backend latency varies over time | `latency-aware` | Uses measured latency and active-request pressure. |
| Streams on one QUIC connection should stay together | `sticky-cid` | Uses the connection ID as the default hash key. |

Start with `round-robin` unless the workload has a specific affinity or
runtime-signal requirement.

## Operational guidance

- All strategies select only healthy backends.
- `round-robin`, `random`, `consistent-hash`, and `sticky-cid` honor weights.
- `least-connections` and `latency-aware` reject any backend weight other than
  the default `100`.
- Consistent hashing preserves affinity while healthy membership is stable;
  backend health or membership changes can move keys.
- Choose a request key that is stable, present on the relevant requests, and
  sufficiently distributed. A low-cardinality key can create hotspots.
- `sticky-cid` provides connection affinity, not user or application-session
  affinity. Use `consistent-hash` with an application key for that purpose.
- Latency-aware selection needs representative traffic before its measurements
  stabilize and deliberately sends bounded exploration traffic.

The complete request-key source list and weight matrix are in
[Routing and Upstreams](/docs/configuration/routing-and-upstreams).

## Configuration shape

Each upstream owns its strategy. Omitting `load_balancing` selects
`round-robin`; the top-level `load_balancing` field is not a v0.6 fallback.

```yaml
load_balancing:
  type: consistent-hash
  key: "cookie:session_id"
```

Add this block under the selected `upstream.<name>`. Use the single canonical
backend-pool example in
[Routing and Upstreams](/docs/configuration/routing-and-upstreams#canonical-example)
instead of copying separate backend lists for each strategy.
