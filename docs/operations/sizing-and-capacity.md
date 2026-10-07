# Capacity Planning and Host Tuning

This guide explains how to size an Impulse node, tune its host, and prove that
the result has enough headroom. There is no universal core count, memory size,
socket-buffer value, or request-rate claim: capacity depends on the traffic,
policy, backend, kernel, network path, and failure modes being tested.

Use the [Configuration Reference](/docs/configuration/reference#performance-configuration)
for exact field defaults and constraints. Use the
[Metrics Reference](/docs/reference/metrics-reference) for metric types, units,
and labels.

## Start with a Workload Model

Record these inputs before changing limits:

- steady and burst request rates, connection-establishment rates, and packet
  rates
- concurrent native QUIC and bootstrap connections
- concurrent streams and requests per connection
- request/response size distributions, including unknown-length and streaming
  bodies
- backend connect and response latency distributions, timeout rates, and pool
  size
- HTTP/3, HTTP/2, and HTTP/1.1 traffic proportions
- TLS handshake and mutual TLS (mTLS) volume
- auth, quota, retry, hedge, tracing, and log policy enabled for the test
- route/upstream/backend distribution and expected hot keys
- drain duration and long-lived tunnel behavior

Test the peak mix and plausible failure mixes—not only an average request on a
healthy backend. A limit protects a resource; it is not a throughput target.

## Resource and Evidence Map

| Decision | Primary configuration | Impulse evidence | Host or infrastructure evidence |
| --- | --- | --- | --- |
| File-descriptor limit | systemd `LimitNOFILE` or host service limit | No direct FD metric; `impulse_active_connections` and `impulse_backend_connect_attempt_total` provide only workload context | Process open-FD count and FD limit; socket counts by state |
| UDP socket buffers | `performance.udp_recv_buffer_bytes`, `performance.udp_send_buffer_bytes` | `impulse_ingress_packets_total`, `impulse_ingress_queue_bytes`, `impulse_ingress_queue_drops`, `impulse_ingress_queue_drop_bytes` | Effective socket sizes, kernel UDP receive/send errors, interface drops |
| Worker and shard count | `performance.worker_threads`, `performance.packet_shards_per_worker`, `performance.reuseport`, `performance.pin_workers` | `impulse_worker_requests_total`, `impulse_worker_ingress_packets_total`, `impulse_worker_requests_failure`, `impulse_worker_ingress_queue_drops` | CPU utilization by thread/core, scheduler pressure, IRQ distribution |
| Connection capacity | `performance.max_active_connections`, `performance.new_connections_per_sec`, `performance.new_connections_burst` | `impulse_active_connections`, `impulse_connection_cap_rejects`, `impulse_ingress_rate_limited_total` | TCP connection count, QUIC client concurrency, FD count, CPU, memory |
| Stream and request concurrency | QUIC stream limits, global/upstream/backend inflight limits, route caps | `impulse_overload_shed_by_reason_total`, `impulse_inflight_wait_admit_total`, `impulse_upstream_request_latency_ms`, `impulse_backend_timeouts` | Backend saturation, CPU, memory, and test-client completion rates |
| Packet queues | `packet_shard_queue_capacity`, `packet_shard_queue_max_bytes` | `impulse_ingress_queue_bytes`, `impulse_ingress_queue_drops`, `impulse_worker_ingress_queue_drops` | Kernel/network drops and host memory |
| Body buffers | Request-buffer and response-prebuffer caps; body-size limits | `impulse_request_buffered_bytes`, `impulse_request_buffered_high_watermark_bytes`, `impulse_request_buffer_limit_rejects`, `impulse_response_prebuffer_limit_rejects` | RSS/cgroup memory, reclaim, swap, and OOM events |

Impulse does not emit process CPU, RSS, open-FD, kernel socket-buffer, or
interface-drop metrics. Collect them from the host, container runtime, or
orchestrator. Do not infer their values from request counters.

## File Descriptors

Descriptors are consumed by listener sockets, accepted bootstrap connections,
backend TCP/TLS connections, files, audit/log outputs, and other runtime
resources. QUIC multiplexes connections over UDP sockets, so downstream QUIC
connection count is not a one-descriptor-per-connection calculation.
Bootstrap and backend connections do consume socket descriptors.

Set the service FD limit from measurement:

1. Run the representative steady workload and record open descriptors.
2. Exercise connection churn, slow backends, long-lived traffic, DNS/client
   rotation, logging, audit, and drain.
3. Record the peak and its relationship to the service hard limit.
4. Add an explicit safety margin derived from the rollout and failure model.
5. Alert before exhaustion and retest after topology or protocol-mix changes.

Validate both the configured systemd limit and the effective process limit.
An extremely high limit does not create memory or backend capacity and must not
be used to mask leaked or unexpectedly retained sockets.

## Socket Buffers and the Network Path

`performance.udp_recv_buffer_bytes` and
`performance.udp_send_buffer_bytes` request buffer sizes for each native QUIC
UDP worker socket. The kernel may cap or adjust the effective sizes. Impulse
logs the requested and effective values at debug level when it can read them
back; also inspect the running socket and host limits.

Tune socket buffers only with the rest of the path:

- kernel receive/send ceilings and UDP error counters
- NIC and virtual-interface drop counters
- device backlog and IRQ placement
- MTU and fragmentation behavior on the real client path
- conntrack or firewall pressure where present
- UDP load-balancer behavior and idle policy

Increasing socket buffers may absorb short bursts but also reserves more kernel
memory per socket. It does not fix a worker that cannot drain packets quickly
enough. Correlate `impulse_ingress_packets_total`,
`impulse_ingress_queue_bytes`, `impulse_ingress_queue_drops`, and
`impulse_ingress_queue_drop_bytes` with kernel UDP errors and interface drops
before deciding which layer needs capacity.

## CPU, Workers, and Packet Shards

`performance.worker_threads` controls data-plane worker topology.
`performance.control_plane_threads` serves asynchronous control work.
`performance.packet_shards_per_worker` adds packet-processing shards behind
each UDP worker socket. More of any of these consumes threads and scheduling
capacity; none guarantees higher throughput.

Choose a baseline that leaves CPU for the kernel, control plane, TLS, metrics,
logging/tracing, and co-located agents. Do not assume one worker per logical CPU
is optimal. Then vary one topology setting at a time.

Use:

- `impulse_worker_requests_total` and
  `impulse_worker_ingress_packets_total` to identify distribution imbalance
- worker failure and ingress-queue-drop counters to locate a pressured worker
- route p95/p99 and `impulse_upstream_request_latency_ms` to detect latency
  regressions
- host CPU by thread/core, run-queue pressure, context switches, and throttling
  to distinguish compute saturation from backend delay

Multiple workers require `performance.reuseport: true`. Enable CPU pinning only
when the target host and IRQ topology show a repeatable benefit. Worker and
control-plane thread changes include startup-owned settings; use the activation
plan and a drain-aware restart when required.

## Connection, Stream, and Admission Limits

These controls protect different scopes and should be sized together:

| Boundary | Fields | Interpretation |
| --- | --- | --- |
| New QUIC connection rate | `performance.new_connections_per_sec`, `performance.new_connections_burst` | Token bucket for unknown Initial packets; existing connections are not charged |
| Active native connections | `performance.max_active_connections` | Hard tracked-QUIC-connection cap per worker |
| QUIC flow control | `performance.quic_initial_max_data`, `performance.quic_initial_max_stream_data` | Advertised connection and stream byte windows |
| QUIC stream count | `performance.quic_initial_max_streams_bidi`, `performance.quic_initial_max_streams_uni` | Advertised stream concurrency; bidirectional value also bounds the request-stream map |
| Request concurrency | `performance.global_inflight_limit`, `performance.per_upstream_inflight_limit`, `performance.per_backend_inflight_limit` | Admission and transport protection at successively narrower scopes |
| Route/upstream caps | `resilience.route_queue.global_cap`, `default_cap`, and `caps` | Additional concurrent admission boundaries |

`impulse_active_connections` covers native QUIC connections, not every
bootstrap TCP connection. Combine it with host TCP/socket/FD measurements when
both ingress paths carry traffic.

Use `impulse_connection_cap_rejects`,
`impulse_ingress_rate_limited_total`, and
`impulse_overload_shed_by_reason_total` to learn which boundary is active.
`reason` distinguishes connection, global/upstream/backend inflight, route,
adaptive-admission, brownout, circuit, and buffer pressure. A rising 503 rate
alone is not evidence that a particular limit should be raised.

Before increasing concurrency, verify that CPU and memory retain headroom,
backend latency does not collapse, timeouts and passive health failures stay
acceptable, and the node recovers promptly after overload. Before lowering a
limit, verify that deliberate shedding still meets the service objective.

## Queue and Memory Limits

Packet and body queues have both performance and memory consequences:

- `performance.packet_shard_queue_capacity` bounds queued datagram count per shard.
- `performance.packet_shard_queue_max_bytes` bounds queued datagram bytes per shard.
- `performance.request_buffer_global_cap_bytes` bounds request backpressure buffering
  across a worker.
- `performance.unknown_length_response_prebuffer_bytes` bounds an upstream
  response before downstream headers are committed.
- request and response body-size limits bound individual streams but are not a
  promise that every concurrent stream can reach its maximum simultaneously.
- inflight and route caps bound the number of requests that can hold state or
  wait on backends.

Watch:

- `impulse_ingress_queue_bytes` and ingress queue drop counters
- `impulse_request_buffered_bytes` and
  `impulse_request_buffered_high_watermark_bytes`
- `impulse_request_buffer_limit_rejects` and
  `impulse_response_prebuffer_limit_rejects`
- overload reasons `request_buffer_cap` and `response_prebuffer_cap`
- host RSS/cgroup working set, memory pressure/reclaim, swap, and OOM events

A queue that is continuously occupied is not healthy merely because it has not
dropped traffic yet. Evaluate queue residence through its effect on request
latency, and keep memory headroom for connections, transport pools, TLS, policy
state, observability, and the operating system.

## Capacity-Test Methodology

Use the same process for every host class and meaningful configuration change:

1. **Define acceptance criteria.** Set request success, p95/p99 latency,
   overload/drop, backend health, CPU, memory, FD, and recovery thresholds.
2. **Capture a baseline.** Record the binary, complete config, host/kernel,
   network path, backend behavior, test-client limits, and all metrics.
3. **Reproduce the traffic mix.** Include protocol proportions, connection
   churn, multiplexing, bodies, streaming, auth/quota, retries, and tracing.
4. **Increase load in steps.** Hold each step long enough to reach stable
   connection, pool, queue, and memory behavior.
5. **Exercise failure cases.** Add slow/unavailable backends, packet loss or
   constrained network paths, DNS changes, quota degradation, and drain.
6. **Find the first violated criterion.** Identify the responsible layer from
   Impulse and host evidence; do not label every failure “CPU capacity.”
7. **Change one variable.** Repeat the same workload and compare the full
   signal set, including recovery after the peak.
8. **Soak below the boundary.** Validate memory, descriptors, connection pools,
   certificate/DNS background work, and tail latency over the required period.
9. **Set production limits below the demonstrated boundary.** Reserve capacity
   for failover, traffic skew, telemetry, and deployment overlap.

The load generator and backends must have independent headroom; otherwise the
test measures them instead of Impulse. Run from the real network topology when
validating UDP, MTU, load balancers, conntrack, or cross-zone behavior.

## Decision Checklist

- [ ] Workload and failure models match expected production traffic.
- [ ] Effective FD limits and open-FD peaks were measured.
- [ ] Requested and effective UDP buffers plus kernel/NIC drops were checked.
- [ ] Worker/shard decisions are supported by per-worker and host CPU evidence.
- [ ] Connection, stream, inflight, and route caps were tested together.
- [ ] Queue high-water marks, rejects, latency, RSS, and OOM risk were reviewed.
- [ ] Backends and the load generator had headroom throughout the test.
- [ ] Overload recovery, drain, and failover behavior met acceptance criteria.
- [ ] Production limits retain an explicit safety margin below the tested
      boundary.

## Related Pages

- [Production Deployment](/docs/deployment/production)
- [Performance Configuration](/docs/configuration/reference#performance-configuration)
- [Resilience Configuration](/docs/configuration/resilience)
- [Metrics Reference](/docs/reference/metrics-reference)
- [Observability Operations](/docs/operations/observability)
- [Operations Runbook](/docs/operations/runbook)
