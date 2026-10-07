# Observability Operations

This page is the operator guide for Impulse observability. It explains what to
watch, which packaged dashboard to open, how to alert, and how to correlate a
traffic symptom with current runtime state.

For the exact emitted metric families, types, labels, units, and meanings, use
the [Metrics Reference](/docs/reference/metrics-reference). Configuration belongs
in [Observability and Control Configuration](/docs/configuration/observability-and-control),
and endpoint behavior belongs in the
[Control API Reference](/docs/reference/control-api-reference).

## Operator Surfaces

Use each surface for the job it answers best:

| Surface | Use it for |
| --- | --- |
| Metrics | Rates, ratios, latency distributions, capacity trends, alerts, and service-level objective (SLO) reporting |
| Structured logs | Event-level diagnosis and request or backend lifecycle detail |
| OTLP traces | Timing and causal sequencing within one request or administrative action |
| Control API | Current runtime generation, backend state, quota state, watchdog state, and retained runtime history |
| Audit output | Actor, action, target, authorization result, generation movement, and administrative change history |

These surfaces use the same operational identities and stable reason
vocabulary. Do not translate a canonical reason into a new dashboard-specific
term. If a value is unavailable, omit it rather than fabricating a placeholder.

## Golden Signals

Start with four questions, then narrow the investigation by subsystem.

| Signal | What to watch | How to interpret it | Metric catalog |
| --- | --- | --- | --- |
| Traffic | Request rate by upstream, status class, and outcome | A fleet-wide change suggests ingress or shared policy; concentration identifies an upstream or backend | [Request results](/docs/reference/metrics-reference#upstream-and-backend-request-results) |
| Errors | Server failures, timeouts, overload shedding, rate limiting, auth denial, and quota decisions | Keep transport failure, self-protection, and contract enforcement separate | [Request totals and authentication](/docs/reference/metrics-reference#request-totals-and-authentication), [overload](/docs/reference/metrics-reference#overload-and-admission), and [quota](/docs/reference/metrics-reference#quota) |
| Latency | Service percentiles, per-upstream latency, and route samples | Read tail growth with timeout, retry, hedge, and backend pressure; low error rate does not make rising tails healthy | [Latency histogram and outcomes](/docs/reference/metrics-reference#upstream-and-backend-request-results) and [route metrics](/docs/reference/metrics-reference#route-metrics) |
| Saturation | Active connections, ingress queues, buffering, inflight admission, and connection caps | Queue growth without drops is an early warning; drops and cap rejects show active saturation | [Connections and ingress](/docs/reference/metrics-reference#connections-and-ingress) and [buffer pressure](/docs/reference/metrics-reference#buffer-and-body-pressure) |

Always add supporting views for:

- backend health, DNS refresh, resolved-address count, and client rotation
- retries and hedges, including denied or wasted attempts
- downstream and upstream TLS, certificate expiry, and reload outcomes
- runtime activation, rollback, watchdog, audit, and Control API pressure

The [Metrics Reference](/docs/reference/metrics-reference) is authoritative for
series names and label values. The repository recording rules are the preferred
query layer for packaged dashboards and alerts.

## Recommended Dashboards

Impulse ships Grafana definitions under `deploy/observability/grafana/`.
Preserve their UIDs when importing them so cross-links and runbooks remain
stable.

| Dashboard | Open it for | Read first |
| --- | --- | --- |
| `edge-traffic.json` | Customer-visible error or latency changes | Request rate, success ratio, tail latency, status mix, and concentration by upstream or backend |
| `admission-overload.json` | Unexpected 429 or 503 responses, brownout, quota, or auth symptoms | Shed reason, rate-limit activity, quota decisions, quota backend health, and auth denial versus dependency failure |
| `backend-health.json` | Timeouts, backend errors, health-check disagreement, or DNS churn | Active and passive health, timeout pressure, DNS refresh, address-set changes, and client rotation |
| `retries-hedges.json` | Increasing duplicate work or masked tail latency | Retry reasons, retry denials, hedge triggers, win ratio, waste, and backend failure pressure |
| `tls-certificates.json` | Handshake failures, certificate rotation, SNI/ALPN issues, or upstream TLS errors | Downstream versus upstream failures, failure reason, certificate lifetime, and selection outcome |
| `control-plane.json` | Activation, rollback, restart, watchdog, audit, or generation problems | Active generation, runtime outcomes, rejections, watchdog state, audit failures, and Control API pressure |

Use `edge-traffic.json` as the default incident entry point. Move to a
specialized dashboard only after identifying the dominant failure class.

## Suggested Alerts

Impulse ships Prometheus rules under `deploy/observability/prometheus/`. Load
`recording-rules.yaml` before `alerts.yaml`; the alerts consume the recording
layer. Tune thresholds and evaluation windows to your SLOs and normal traffic,
but preserve each alert's meaning.

`page` means immediate action is expected because user impact or control-plane
safety is at risk. `ticket` means investigation is required but immediate
paging is not assumed.

### Page Alerts

| Alert | Meaning | First view |
| --- | --- | --- |
| `ImpulseAvailabilityBurnRatePage` | Availability budget is burning in both fast and sustained windows | Edge traffic |
| `ImpulseP99LatencyBurnPage` | Tail latency is materially above the packaged objective | Edge traffic, then backend health |
| `ImpulseBackendTimeoutSurgePage` | Backend timeout pressure threatens request reliability | Backend health |
| `ImpulseTlsCertificateExpiryCritical` | A downstream certificate is inside the critical expiry window | TLS and certificates |
| `ImpulseWatchdogDegraded` | Watchdog degradation is continuous | Control plane |
| `ImpulseRuntimePanicObserved` | A runtime task panic occurred in the recent window | Control plane and logs |
| `ImpulseControlPlaneUnavailable` | The packaged control-plane observability view is absent | Scrape health, then Control API |

### Ticket Alerts

| Alert | Meaning | First view |
| --- | --- | --- |
| `ImpulseRetryGrowth` | Retry volume may be amplifying backend trouble | Retries and hedges |
| `ImpulseHedgeGrowth` | Hedging is becoming routine instead of exceptional | Retries and hedges |
| `ImpulseBackendDnsRefreshFailures` | Resolution is stale or unstable | Backend health |
| `ImpulseBrownoutActiveTooLong` | Brownout remains active beyond the tolerated window | Admission and overload |
| `ImpulseQuotaBackendDegraded` | The distributed quota dependency or fallback path is degraded | Admission and overload, then runtime state |
| `ImpulseTlsHandshakeFailuresRising` | Downstream handshake failures exceed normal background levels | TLS and certificates |

Add environment-specific alerts for sustained ingress queue growth, ingress
drops, connection-cap rejection, buffer rejection, audit write failure, audit
event drop, secret reload failure, and certificate reload failure. Alert on
rates or sustained state, not on a counter's absolute lifetime value.

## Label Cardinality

Stable dashboard and alert dimensions include:

- `upstream`, `backend`, `listener`, and `route`
- `status_class`, `outcome`, `reason`, and `failure_class`
- `policy`, `decision`, `backend_mode`, and `component`
- active or recently retained `generation` values

Do not add traffic-derived values as default metric labels or dashboard
variables. Raw paths, query strings, user or tenant IDs, tokens, client IPs,
certificate fingerprints, request IDs, trace IDs, and arbitrary headers grow
with traffic and belong in logs, traces, audit events, or focused Control API
views.

Prefer the labeled upstream and backend request families over coarse
process-wide compatibility counters when localization matters. Preserve source
labels while filtering; do not create a new label vocabulary in recording
rules.

## Correlate Metrics with Runtime State

Metrics describe trend. The Control API describes the state that produced the
trend, and audit output describes who changed it.

Use this sequence:

1. Record the alert window and its bounded labels: listener, route, upstream,
   backend, policy, reason, decision, and backend mode.
2. Open the matching dashboard and decide whether the symptom is traffic,
   admission, backend, TLS, or control-plane scoped.
3. Read `GET /admin/runtime` for the active generation, backend inventory,
   quota backend state, watchdog state, listener TLS inventory, and recent
   administrative activity.
4. Read `GET /admin/runtime/history` or
   `GET /admin/runtime/history/{generation}` when timing aligns with an
   activation or rollback.
5. Use audit output for actor, action, target, authorization, result, and
   generation attribution.
6. Use logs or traces for request-level detail, carrying forward the same
   canonical identities and reason value.

For Impulse v0.6, the runtime snapshot reports observability contract version
`v1` and audit schema version `v1`. Treat a version change as a compatibility
event for dashboards, alerts, runbooks, and audit consumers.

Useful cross-surface fields are `request_id`, `trace_id`, `span_id`,
`event_id`, `generation`, `listener`, `route`, `upstream`, `backend`, `policy`,
`component`, `reason`, and `failure_class`. Only bounded fields belong on
metrics; request- and event-specific IDs are diagnostic fields.

## Incident Interpretation

### Rising 5xx or Latency

1. Check whether the change is fleet-wide or concentrated by upstream or
   backend.
2. Separate upstream responses from timeout, transport, overload, and policy
   outcomes.
3. If timeouts dominate, inspect backend health, DNS lifecycle, retries, and
   hedges together.
4. If self-protection dominates, inspect the exact overload reason and current
   admission state before adding capacity or changing policy.
5. Check runtime history for a generation change at the start of the event.

### 429, Denial, or 503 Growth

Do not combine scoped rate limiting, quota denial, authentication denial,
circuit-open rejection, and overload shedding into one error bucket. They have
different owners and remediation:

- rate-limit and quota decisions enforce configured contracts
- authentication denial is an identity or authorization result
- auth or quota dependency failure is a dependency-health problem
- overload shedding and brownout protect capacity
- circuit-open rejection protects against an unhealthy backend path

Confirm the policy, decision, reason, and backend mode in metrics and current
runtime state before changing limits.

### Backend or DNS Instability

Compare active health checks with passive request failures. Healthy probes with
rising request timeouts can indicate workload-specific latency, saturation, or
stale pooled connections. DNS refresh failures, address-set changes, and client
rotation failures together indicate lifecycle churn; inspect resolved addresses
and last-success state in the runtime snapshot.

### Retry or Hedge Growth

Retry and hedge activity is not success by itself. Read it with latency,
timeouts, backend errors, and saturation. High hedge waste or sustained retry
growth means duplicate work may be increasing backend pressure even if some
requests still complete successfully.

### TLS or Certificate Incident

Separate downstream client-to-Impulse handshakes from upstream
Impulse-to-backend TLS. Check listener, phase, reason, certificate lifetime,
and recent reload outcomes. After rotation, confirm both the metric trend and
the runtime listener or upstream identity before expanding the rollout.

### Runtime or Control API Incident

Correlate activation, rollback, rejection, watchdog, panic, connection-limit,
and audit-delivery signals with the active generation. Runtime history explains
generation movement; audit output establishes the action sequence and actor.
An unavailable Control API does not by itself prove data-plane failure, but it
does remove a critical incident-response surface.

## SLO Interpretation

The packaged SLO definitions under `deploy/observability/slo/` intentionally
keep these contracts separate:

- availability counts customer-visible server failure, not every rejection
- latency describes successful service and excludes rejected or timed-out work
- overload measures capacity protection, not quota or authentication policy
- backend timeout is narrower than all backend failure
- authentication denial is separate from generic policy rejection
- quota denial is contract enforcement and must be read with quota backend
  health and fallback mode

Use the packaged recording series for reporting instead of recreating their
numerators and denominators in Grafana.

## Package Rollout

1. Load the recording rules and wait for their series to appear.
2. Load the alert rules and confirm they evaluate without missing inputs.
3. Import the dashboard JSON while preserving packaged UIDs.
4. Verify the runtime snapshot's observability contract and audit schema
   versions.
5. Exercise one page alert, one ticket alert, and one dashboard query in a
   staging or canary environment.

Treat repository dashboard JSON, recording rules, alert rules, and SLO
definitions as one versioned operator package. Review a change to any one of
them against the others.

## Related Pages

- [Metrics Reference](/docs/reference/metrics-reference)
- [Observability and Control Configuration](/docs/configuration/observability-and-control)
- [Control API Reference](/docs/reference/control-api-reference)
- [Control Plane Operations](/docs/operations/control-plane)
- [Distributed Quota](/docs/operations/distributed-quota)
- [Runbook](/docs/operations/runbook)
