# Metrics Reference

This page is the authority for metric families emitted by Impulse v0.6. The
inventory comes from the current Prometheus renderer and records each family's
exposition type, labels, unit, and meaning.

## Endpoint and Exposition

- method: `GET`
- configured path: `observability.metrics.path`
- default path: `/metrics`
- format: Prometheus text exposition

The endpoint configuration, bind restrictions, mTLS behavior, and connection
limits are documented in
[Observability and Control Configuration](/docs/configuration/observability-and-control#metrics-endpoint).

In the tables below, `—` means the family has no labels or no physical unit.
Counters are cumulative for the process lifetime unless their labeled state is
removed during runtime reconciliation. Unix-time gauges are seconds since the
Unix epoch.

## Request Totals and Authentication

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_requests_total` | counter | — | requests | Requests seen by the proxy. |
| `impulse_requests_success` | counter | — | requests | Successful upstream responses. |
| `impulse_requests_failure` | counter | — | requests | Failed requests. |
| `impulse_request_validation_rejects` | counter | — | requests | Requests rejected by protocol validation. |
| `impulse_policy_denied` | counter | — | requests | Requests denied by runtime method/path policy. |
| `impulse_external_auth_allowed` | counter | — | decisions | Requests explicitly allowed by external authorization. |
| `impulse_external_auth_denied` | counter | — | decisions | Requests denied, challenged, or redirected by external authorization. |
| `impulse_external_auth_timeout` | counter | — | decisions | External-authorization decisions that timed out. |
| `impulse_external_auth_error` | counter | — | decisions | External-authorization transport or execution failures. |
| `impulse_request_rate_limited` | counter | — | requests | Requests rejected by scoped rate limits. |

The three unlabeled request-total families are coarse compatibility aggregates.
They remain current and are not deprecated, but they do not identify an
upstream, backend, status class, or terminal outcome.

## Upstream and Backend Request Results

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_upstream_requests_total` | counter | `upstream`, `status_class`, `outcome` | requests | Completed requests grouped by upstream pool, HTTP status class, and coarse terminal outcome. |
| `impulse_backend_requests_total` | counter | `upstream`, `backend`, `status_class`, `outcome` | requests | The same completed requests grouped additionally by selected backend. `backend="__none__"` represents no selected backend. |
| `impulse_upstream_request_latency_ms` | histogram | `upstream`, `outcome`; `le` on buckets | milliseconds | End-to-end request latency grouped by upstream and coarse outcome. |

Histogram exposition uses `impulse_upstream_request_latency_ms_bucket`,
`impulse_upstream_request_latency_ms_sum`, and
`impulse_upstream_request_latency_ms_count`. Bucket bounds are `1`, `5`, `10`,
`25`, `50`, `100`, `250`, `500`, `1000`, `2000`, `5000`, `10000`, `30000`,
`60000`, and `+Inf` milliseconds.

`status_class` is one of `1xx`, `2xx`, `3xx`, `4xx`, `5xx`, `other`, or
`unknown`. `outcome` is one of `success`, `failure`, `rate_limited`, `timeout`,
`backend_error`, or `overload_shed`. These coarse outcome values are preserved
for compatibility; several more-specific terminal reasons intentionally map to
`failure`.

## Route Metrics

The `route` label is the upstream pool name selected by routing. Requests that
never select a pool use `route="unrouted"`.

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_route_requests_total` | counter | `route` | requests | Completed requests for the route. |
| `impulse_route_success_total` | counter | `route` | requests | Successful route outcomes. |
| `impulse_route_failure_total` | counter | `route` | requests | Failed route outcomes. |
| `impulse_route_timeout_total` | counter | `route` | requests | Timed-out route outcomes. |
| `impulse_route_rate_limited_total` | counter | `route` | requests | Rate-limited route outcomes. |
| `impulse_route_backend_error_total` | counter | `route` | requests | Backend-error route outcomes. |
| `impulse_route_overload_shed_total` | counter | `route` | requests | Overload-shed route outcomes. |
| `impulse_route_latency_sample_every` | gauge | — | requests per sample | Route-latency sampling interval. `1` means every request. |
| `impulse_route_latency_ms_p50` | untyped | `route` | milliseconds | Approximate p50 over the route's sampled latency buckets. |
| `impulse_route_latency_ms_p95` | untyped | `route` | milliseconds | Approximate p95 over the route's sampled latency buckets. |
| `impulse_route_latency_ms_p99` | untyped | `route` | milliseconds | Approximate p99 over the route's sampled latency buckets. |

The sampling interval comes from `IMPULSE_ROUTE_LATENCY_SAMPLE_EVERY` and
defaults to `1`. The three percentile series are gauge-like current values, but
the v0.6 renderer emits no Prometheus `# TYPE` declaration for them; consumers
therefore parse them as `untyped`.

## Worker Metrics

`worker` is a process-local label in the form `worker-<zero-based-index>`.

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_worker_requests_total` | counter | `worker` | requests | Requests handled by each worker. |
| `impulse_worker_requests_success` | counter | `worker` | requests | Successful requests by worker. |
| `impulse_worker_requests_failure` | counter | `worker` | requests | Failed requests by worker. |
| `impulse_worker_ingress_packets_total` | counter | `worker` | packets | UDP ingress packets processed by worker. |
| `impulse_worker_ingress_queue_drops` | counter | `worker` | packets | Ingress packets dropped from full shard queues by worker. |
| `impulse_worker_ingress_queue_drop_bytes` | counter | `worker` | bytes | Bytes in worker-attributed ingress queue drops. |

## Early Data, Health, and Backend Errors

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_early_data_accepted` | counter | — | requests | Requests accepted in QUIC early data. |
| `impulse_early_data_rejected` | counter | — | requests | Requests rejected in QUIC early data. |
| `impulse_health_checks_total` | counter | — | checks | Active health checks executed. |
| `impulse_health_checks_success` | counter | — | checks | Successful active health checks. |
| `impulse_health_checks_failure` | counter | — | checks | Failed active health checks. |
| `impulse_backend_timeouts` | counter | — | events | Backend timeout events. |
| `impulse_backend_errors` | counter | — | events | Backend error events. |
| `impulse_health_failures_total` | counter | `reason` | failures | Passive backend-health failures. |

`impulse_health_failures_total.reason` is `5xx`, `timeout`, `transport`, or
`tls`. Circuit-open rejection is not added to this family.

## Overload and Admission

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_overload_shed` | counter | — | requests | Requests shed by overload controls. |
| `impulse_overload_shed_by_reason_total` | counter | `reason` | requests | Overload-shed decisions grouped by their limiting mechanism. |
| `impulse_inflight_wait_admit_total` | counter | `scope` | requests | Requests admitted after the configured inflight micro-wait. |
| `impulse_brownout_active` | gauge | — | boolean | `1` while brownout is active; otherwise `0`. |
| `impulse_circuit_breaker_rejected_total` | counter | — | requests | Requests rejected by an open circuit. |

Overload `reason` values are `brownout`, `adaptive_admission`, `route_cap`,
`route_global_cap`, `global_inflight`, `upstream_inflight`,
`backend_inflight`, `circuit_open`, `request_buffer_cap`,
`response_prebuffer_cap`, and `connection_cap`. Inflight `scope` is `global` or
`upstream`.

## Quota

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_quota_policy_outcomes_total` | counter | `policy`, `decision`, `reason`, `selector_dimensions`, `backend_mode` | decisions | Outcomes for a matched quota policy. |
| `impulse_quota_backend_health_total` | counter | `backend_mode`, `reason` | observations | Quota backend availability and error observations. |

Quota decision values are `allowed`, `denied`, `shadow_denied`, `failed_open`,
`failed_closed`, and `not_applied`. Policy reasons are `allowed`, `not_applied`,
`burst_quota_exhausted`, `sustained_quota_exhausted`,
`selector_identity_missing`, `selector_identity_invalid`, `backend_timeout`,
`backend_unavailable`, and `backend_error`. Backend-health reasons are
`available`, `timeout`, `unavailable`, and `error`. `selector_dimensions` is
the canonical `+`-joined selector composition; `backend_mode` also identifies
degraded local-fallback modes.

## Connections and Ingress

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_active_connections` | gauge | — | connections | Current active QUIC connections. |
| `impulse_connection_cap_rejects` | counter | — | connections | New connection attempts rejected by `max_active_connections`. |
| `impulse_ingress_packets_total` | counter | — | packets | UDP packets processed by ingress. |
| `impulse_ingress_queue_drops` | counter | — | packets | Packets dropped because an ingress shard queue was full. |
| `impulse_ingress_queue_drop_bytes` | counter | — | bytes | Datagram bytes dropped because ingress shard queues were full. |
| `impulse_ingress_queue_bytes` | gauge | — | bytes | Bytes currently buffered in ingress shard queues. |
| `impulse_ingress_bad_header_total` | counter | — | packets | Packets dropped because the QUIC header could not be parsed. |
| `impulse_ingress_rate_limited_total` | counter | — | packets | Initial packets dropped by the new-connection rate limiter. |
| `impulse_ingress_unroutable_total` | counter | — | packets | Non-Initial packets received for unknown connections. |
| `impulse_ingress_draining_drops_total` | counter | — | packets | Packets dropped while the listener is draining. |
| `impulse_ingress_connection_create_failed_total` | counter | — | packets | Packets dropped because creation of a QUIC connection failed. |
| `impulse_ingress_version_neg_failed_total` | counter | — | packets | Packets dropped because a version-negotiation response could not be built. |
| `impulse_scid_rotations` | counter | — | rotations | Source connection ID rotations. |

## Buffer and Body Pressure

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_request_buffered_bytes` | gauge | — | bytes | Bytes currently held in request backpressure buffers. |
| `impulse_request_buffered_high_watermark_bytes` | gauge | — | bytes | Highest request-buffer usage observed since process start. |
| `impulse_request_buffer_limit_rejects` | counter | — | requests | Requests rejected by request-buffer byte caps. |
| `impulse_response_prebuffer_limit_rejects` | counter | — | responses | Unknown-length upstream responses rejected by the prebuffer cap. |

## Retries and Hedging

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_retries_total` | counter | — | attempts | Retry attempts across all routes. |
| `impulse_retry_denied_total` | counter | `reason` | attempts | Retry attempts blocked by policy or available request state. |
| `impulse_retry_attempts_total` | counter | `reason` | attempts | Retries started for the classified prior error. |
| `impulse_hedge_triggered_total` | counter | — | attempts | Hedge attempts started. |
| `impulse_hedge_won_total` | counter | — | requests | Requests for which the hedge response arrived first. |
| `impulse_hedge_wasted_total` | counter | — | attempts | Hedge attempts that did not win. |
| `impulse_hedge_primary_won_after_trigger_total` | counter | — | requests | Hedged requests for which the primary still won. |
| `impulse_hedge_primary_late_ms_total` | counter | — | milliseconds | Sum of primary lateness after hedge trigger. |
| `impulse_hedge_primary_late_samples_total` | counter | — | observations | Lateness observations contributing to the aggregate. |

Retry-denial reasons are `budget`, `no_bodyless`, and `no_alternate`.
Retry-attempt reasons are `timeout`, `transport`, and `pool`.

## Downstream TLS

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_downstream_tls_handshake_success_total` | counter | — | handshakes | Successful downstream TLS handshakes across listeners. |
| `impulse_downstream_tls_handshake_failure_total` | counter | `listener`, `reason` | handshakes | Failed downstream TLS handshakes by listener and classified reason. |
| `impulse_downstream_tls_certificate_selection_total` | counter | `listener`, `selection` | handshakes | Server-certificate selection results. |
| `impulse_downstream_tls_alpn_total` | counter | `listener`, `protocol` | handshakes | Negotiated ALPN protocols. |
| `impulse_downstream_tls_certificate_not_after_seconds` | gauge | `listener`, `server_name` | Unix seconds | Certificate expiration timestamp. `server_name="__default__"` is the default identity. |
| `impulse_downstream_tls_certificate_days_remaining` | gauge | `listener`, `server_name` | days | Non-negative estimated time until certificate expiration. |

Handshake failure reasons are `missing_client_cert`, `unknown_issuer`,
`expired_client_cert`, `invalid_client_cert`, `alpn`, and `handshake`.
Certificate selection is `exact_sni`, `default_only`, `fallback_no_sni`, or
`fallback_unmatched_sni`. `protocol` is the negotiated ALPN string, or `none`.

## Upstream TLS and Client Certificates

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_upstream_tls_failure_total` | counter | `upstream`, `backend`, `phase`, `reason` | failures | Upstream TLS failures, including upstream mTLS failures. |
| `impulse_upstream_client_certificate_not_after_seconds` | gauge | `upstream` | Unix seconds | Expiration timestamp for the upstream client certificate. |
| `impulse_upstream_client_certificate_days_remaining` | gauge | `upstream` | days | Non-negative estimated time until the upstream client certificate expires. |

`phase` is currently `bootstrap` or `data_plane`. TLS failure reasons are
`unknown_issuer`, `expired_certificate`, `hostname_mismatch`, `alpn`,
`handshake`, `client_certificate_missing`, `client_key_missing`,
`client_identity_invalid`, `client_auth_rejected`, and
`client_certificate_expired`. There is no separate
`impulse_upstream_mtls_handshake_failure_total`; upstream mTLS failures use
`impulse_upstream_tls_failure_total`.

## Secrets and Certificate Reloads

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_secret_reload_total` | counter | `scope`, `result`, `reason` | operations | Secret or certificate reload outcomes. |
| `impulse_secret_resolve_total` | counter | `provider`, `result`, `reason` | operations | Secret-reference resolution outcomes. |
| `impulse_secret_last_success_unixtime` | gauge | `scope` | Unix seconds | Last successful secret or certificate load for the scope. |
| `impulse_control_plane_cert_reload_total` | counter | `result`, `reason` | operations | Control-plane listener certificate reload outcomes. |

Current scopes include `listeners` and `upstreams`; providers include `file`,
`literal`, and `unknown`. `result` is `success` or `failed`. Successful
resolution uses `reason="resolved"`; certificate reloads use
`cert_reload_applied` or `cert_reload_failed`. Upstream secret reload reasons
also use runtime activation and upstream-mTLS material reason slugs.

## Backend DNS, Connections, and Client Rotation

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_backend_dns_refresh_success_total` | counter | — | refreshes | Successful backend DNS refreshes across all backends. |
| `impulse_backend_dns_refresh_failure_total` | counter | — | refreshes | Failed backend DNS refreshes across all backends. |
| `impulse_backend_dns_address_set_changes_total` | counter | — | refreshes | Successful refreshes that changed the resolved address set. |
| `impulse_backend_client_rotations_total` | counter | — | rotations | Successful backend-client rotations caused by DNS address-set changes. |
| `impulse_backend_client_rotation_failures_total` | counter | — | rotations | Failed rotations after DNS changes; stale pooled connections may remain. |
| `impulse_backend_dns_last_refresh_success_seconds` | gauge | `backend` | Unix seconds | Last successful DNS refresh for the backend identity. |
| `impulse_backend_dns_resolved_addresses` | gauge | `backend` | addresses | Current resolved-address count retained for the backend. |
| `impulse_backend_client_rotations` | counter | `backend` | rotations | Successful DNS-triggered client rotations by backend. |
| `impulse_backend_connect_attempt_total` | counter | `backend`, `hostname`, `resolved_addr` | attempts | Observed upstream socket connection attempts to resolved addresses. |

The five unlabeled families are process-wide aggregates. The similarly named
`impulse_backend_client_rotations{backend=...}` family is the per-backend
breakdown. Connect-attempt cardinality is capped at 512 distinct keys; after
the cap, new hostname/address combinations use `hostname="__over_cap__"` and
`resolved_addr="__over_cap__"` for each backend.

## JWT and JWKS

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_jwt_validation_failures_total` | counter | `reason` | validations | JWT validation failures by stable rejection reason. |
| `impulse_jwt_algorithm_rejections_total` | counter | `algorithm` | validations | Tokens rejected because the JOSE algorithm is not allowed. |
| `impulse_jwks_unknown_kid_total` | counter | `jwks_source_id` | events | Unknown-key-ID events that entered JWKS miss handling. |
| `impulse_jwks_refresh_success_total` | counter | `jwks_source_id` | refreshes | Successful JWKS refreshes. |
| `impulse_jwks_refresh_failure_total` | counter | `jwks_source_id` | refreshes | Failed JWKS refreshes. |
| `impulse_jwks_age_seconds` | gauge | `jwks_source_id` | seconds | Age of the active key set since the last successful refresh; `0` before one exists. |
| `impulse_jwks_state` | gauge | `jwks_source_id`, `state` | boolean | Value `1` on the source's current cache-state series. |
| `impulse_jwks_active_keys` | gauge | `jwks_source_id` | keys | Active verification keys retained for the source. |
| `impulse_jwks_last_refresh_attempt_seconds` | gauge | `jwks_source_id` | Unix seconds | Last refresh-attempt timestamp; `0` if absent. |
| `impulse_jwks_last_refresh_success_seconds` | gauge | `jwks_source_id` | Unix seconds | Last successful-refresh timestamp; `0` if absent. |

`jwks_source_id` is an opaque source identifier; the endpoint URL is not a
label. State values are `never_fetched`, `fresh`, `stale`,
`refresh_failed_retained`, `quarantined_retained`, and `empty_unusable`.

## Runtime and Control Plane

| Metric | Type | Labels | Unit | Meaning |
| --- | --- | --- | --- | --- |
| `impulse_runtime_validation_attempts_total` | counter | — | operations | Staged runtime validation requests accepted by the Control API. |
| `impulse_runtime_preview_attempts_total` | counter | — | operations | Staged runtime preview requests accepted by the Control API. |
| `impulse_runtime_activation_total` | counter | `result`, `reason` | operations | Runtime activation outcomes. |
| `impulse_runtime_rollback_total` | counter | `result`, `reason` | operations | Runtime rollback outcomes. |
| `impulse_runtime_rejections_total` | counter | `reason` | rejections | Activation or rollback rejection reasons. |
| `impulse_runtime_active_generation` | gauge | — | generation | Active runtime generation identifier. |
| `impulse_runtime_history_depth` | gauge | — | entries | Retained runtime-history entries visible to the active generation. |
| `impulse_control_api_connection_limit_drops` | counter | — | connections | Control API connections dropped by its maximum-connection limiter. |
| `impulse_control_api_audit_event_drops` | counter | — | events | Administrative audit records dropped before persistence. |
| `impulse_control_api_audit_write_failures` | counter | — | failures | Audit-sink open or write failures. |
| `impulse_watchdog_restart_requests` | counter | — | requests | Restart requests made by the watchdog. |
| `impulse_watchdog_restart_hooks` | counter | — | executions | Watchdog restart commands executed. |
| `impulse_watchdog_degraded_windows` | counter | — | windows | Watchdog evaluation windows classified as degraded. |
| `impulse_runtime_panics` | counter | — | panics | Runtime task panics observed. |

Activation and rollback `result` is `success` only with `reason="applied"`;
otherwise it is `failure`. Rejection and failure reasons are `invalid_config`,
`startup_owned_change`, `bind_conflict`, `resource_prepare_failed`,
`incompatible_reload`, `unknown_generation`, and `rollback_not_allowed`.

## Compatibility and Deprecation Status

No emitted v0.6 metric family is marked deprecated in the current source.
These compatibility surfaces are intentionally retained:

- unlabeled `impulse_requests_total`, `impulse_requests_success`, and
  `impulse_requests_failure` alongside the labeled upstream, backend, route,
  and worker families
- coarse `outcome` label values on request-result families
- process-wide backend DNS and rotation counters alongside per-backend state
  and rotation families

Do not infer a missing family from a related feature name. In particular,
upstream mTLS failures are part of `impulse_upstream_tls_failure_total`, not a
separate mTLS counter.

## Related Pages

- [Observability and Control Configuration](/docs/configuration/observability-and-control)
- [Observability Contract](/docs/architecture/observability-contract)
- [Metrics and Alerts](/docs/operations/metrics-and-alerts)
- [Control API Reference](/docs/reference/control-api-reference)
