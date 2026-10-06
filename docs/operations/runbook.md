# Operations Runbook

This is the canonical symptom-driven runbook for Impulse incidents. It covers
operator-visible failure semantics, read-only diagnosis, safe recovery, and the
point at which an incident should be escalated. For exact metric labels and
endpoint contracts, use the [Metrics Reference](/docs/reference/metrics-reference)
and [Control API Reference](/docs/reference/control-api-reference).

## Triage Rules

Start with the client-visible result, then correlate it with the active runtime
generation, metrics, logs, and the most recent deployment or activation.

| Result | Typical interpretation |
| --- | --- |
| `400` | Malformed or unsupported request shape. |
| `401` | Request authentication failed or credentials are missing. |
| `403` | Authentication, authorization, or request-policy denial. |
| `405` | Method-policy denial. |
| `408` | Request-body idle/total timeout or total-request timeout. |
| `413` | Request body exceeded its configured limit. |
| `429` | Scoped rate-limit or quota contract rejection; it is not overload shedding. |
| `502` | Route/upstream resolution failure, or upstream transport, TLS, protocol, or bridge failure before a valid response. |
| `503` | No usable backend, overload/prebuffer protection, unavailable auth dependency, or fail-closed quota-backend failure. |
| `504` | Upstream, response-body, or external-authorization timeout. |

A genuine upstream 5xx is a backend application response. A proxy-generated
5xx is an Impulse routing, selection, transport, timeout, or protection outcome.
Use the response body, request outcome labels, and logs to distinguish them.
Some failures before an HTTP request exists—malformed QUIC packets, unknown
connections, or new connections during drain—are observable only as drops or
stream termination.

The checks below are read-only. `GET` requests, log inspection, socket/process
inspection, certificate decoding, and metric queries do not change runtime
state. Every `POST`, file replacement, restart, or traffic shift is a remediation
action and must follow the normal change process.

## Process will not start

### Observable signal

- The service exits, restarts repeatedly, or remains in a failed state.
- No configured listener is bound and health/readiness cannot be reached.
- Startup logs contain a fatal configuration, privilege, TLS, secret, or runtime-preparation error.

### Likely causes

- The explicit configuration path is missing, unreadable, invalid YAML, or fails schema/normalization checks.
- A required certificate, key, CA, or file-backed secret is absent, unreadable, malformed, or mismatched.
- The configured user/group, privilege drop, file-descriptor limit, or required capability is invalid.
- A required metrics or Control API listener cannot be prepared.
- Initial runtime construction failed because a backend, policy, or secret could not be prepared.

### Read-only diagnostic checks

```bash
systemctl status impulse --no-pager
journalctl -u impulse --since "30 minutes ago" --no-pager
systemctl cat impulse
systemctl show impulse -p User -p Group -p LimitNOFILE -p AmbientCapabilities
```

Confirm the service's exact `--config` path, then inspect the path and parent
permissions with `namei -l <path>` and `ls -l <path>`. Decode certificates with
`openssl x509 -in <cert.pem> -noout -subject -issuer -dates`; do not print secret
or private-key contents. `impulse --config <path>` is not a validation-only
command: a valid configuration proceeds to listener startup.

### Safe remediation

- Restore the last known-good configuration or binary when the failure follows a change.
- Correct ownership, permissions, paths, or malformed material without broadening access beyond the service account.
- Validate a candidate through a controlled non-production startup or another instance's Control API `validate → preview → activate` workflow.
- Restart one drained instance and restore traffic only after its probes and telemetry are healthy.

### Escalation criteria

Escalate if a known-good artifact still fails, the process panics, worker/runtime
construction fails without a specific rejected field, or recovery would require
changing security boundaries or all production instances at once.

## Listener will not bind

### Observable signal

- Logs report address-in-use, permission-denied, unavailable-address, or socket-creation errors.
- The process is not ready because a required TCP or UDP socket is absent.
- Local socket inspection does not show the configured listener.

### Likely causes

- Another process owns the address and port.
- A privileged port is configured without the required service privilege or capability.
- The address is not present on the host, or worker socket reuse is incompatible with the configured worker count.
- Only one side of a shared HTTP/3/bootstrap deployment is available: native QUIC needs UDP, while the bootstrap compatibility listener uses TCP.

### Read-only diagnostic checks

```bash
ss -lntup
ip address show
systemctl show impulse -p User -p Group -p AmbientCapabilities
getcap /path/to/impulse
journalctl -u impulse --since "30 minutes ago" --no-pager
```

Compare the owning PID, address family, protocol, address, and port with the
listener configuration. A firewall can make a bound listener unreachable, but
it does not itself cause a local bind failure.

### Safe remediation

- Remove the conflicting service through its normal change procedure, or assign Impulse an approved address/port.
- Grant only the required bind capability, or use an unprivileged port.
- Correct an unavailable address or worker/reuse-port setting, then restart a drained instance.
- Verify TCP and UDP reachability independently where both listener types are configured.

### Escalation criteria

Escalate on unexplained kernel/resource errors, inconsistent binds across
identical hosts, or continued external unreachability after the correct local
sockets and network policy are verified.

## TLS handshake failure

### Observable signal

- Clients cannot establish downstream TLS/QUIC, or secure backends fail during upstream TLS setup.
- `impulse_downstream_tls_handshake_failure_total` or `impulse_upstream_tls_failure_total` rises.
- Certificate-selection or ALPN metrics differ from the expected listener and hostname.

### Likely causes

- A certificate is expired, unreadable, mismatched with its private key, or does not cover the requested SNI name.
- Downstream client authentication is required and the client certificate is missing or untrusted.
- Client and listener ALPN/protocol expectations do not overlap.
- Upstream hostname verification, CA trust, client certificate, or backend TLS mode is wrong.

### Read-only diagnostic checks

- Inspect the active listener and upstream TLS inventory in `GET /admin/runtime`.
- Query downstream handshake, certificate-selection, ALPN, and expiry metrics; query upstream TLS failures by `upstream`, `backend`, `phase`, and `reason`.
- Decode local certificate metadata with `openssl x509`; check key correspondence without displaying key material.
- Use `openssl s_client` for TCP TLS. Use an HTTP/3-capable client for native QUIC and record SNI and negotiated ALPN.

### Safe remediation

- For downstream material replaced at existing paths, restore valid material atomically and call `POST /admin/runtime/reload-certs`.
- For a downstream path, SNI mapping, or client-auth policy change, use `validate → preview → activate`, then `reload-certs`.
- For upstream CA, client certificate, key, hostname, or verification changes, use `validate → preview → activate`; `reload-certs` does not update upstream TLS.
- Keep the previous material until new handshakes are verified.

### Escalation criteria

Escalate if known-good identities still fail, handshake behavior differs by
worker, active TLS inventory disagrees with the served identity, or the evidence
suggests private-key exposure or a protocol-library failure.

## No matching route

### Observable signal

- The client receives `502 Bad Gateway` with `no route`.
- Expected route/upstream request counters do not increase.
- Logs show route resolution completed without a match.

### Likely causes

- Host/authority, path, or normalized method does not match the configured route.
- A wildcard or precedence assumption is wrong.
- The expected route is not in the active generation.
- The client sent a different authority, path, or method from the one being diagnosed.

### Read-only diagnostic checks

- Capture the exact request authority, path, and method without logging credentials.
- Read `GET /admin/runtime` and `GET /admin/runtime/history` to confirm the active generation and route set.
- Compare the request with the matching and precedence rules in [Routing and Upstreams](/docs/configuration/routing-and-upstreams).
- Inspect route/upstream/backend request metrics and route-resolution logs for the same time window.

### Safe remediation

- Correct the client request if it violates the intended contract.
- Otherwise make the route matcher explicit, preview the diff, and activate the corrected generation.
- Verify the intended route and upstream counters increase before expanding rollout.

### Escalation criteria

Escalate if the active route should match under documented normalization and
precedence but does not, or if workers appear to use different generations.

## Backend unavailable

### Observable signal

- The client receives `503` because no usable backend is available, `502` from an upstream transport/TLS failure, or `504` from an upstream timeout.
- Backend timeouts/errors or health-check failures rise.
- The runtime snapshot reports an upstream with no healthy members.

### Likely causes

- The backend process, network path, health endpoint, or dependency is unavailable.
- Health-check path, port, timeout, TLS mode, or backend protocol is wrong.
- DNS resolution or client rotation produced no currently usable member.
- Every backend is unhealthy, suppressed, or rejected by an open circuit.

### Read-only diagnostic checks

- Inspect backend inventory and health in `GET /admin/runtime`.
- Query `impulse_health_checks_total`, health successes/failures, `impulse_health_failures_total`, backend errors/timeouts, and backend request outcomes.
- From the Impulse network boundary, check the configured health endpoint and, for TLS, the expected hostname and trust chain.
- Correlate failures with DNS, rotation, circuit-breaker, deploy, and latency signals.

### Safe remediation

- Restore the backend application or network path; isolate a clearly failing member through the normal rollout workflow.
- Correct health-check, protocol, TLS, or endpoint configuration through `validate → preview → activate`.
- Reduce traffic or add healthy capacity before increasing retries or timeouts.
- Reintroduce members gradually while watching health and request outcomes.

### Escalation criteria

Escalate if all members transition together without an external cause, runtime
health disagrees with direct checks, healthy/unhealthy state flaps persist, or
recovery requires bypassing verification or health protection.

## Elevated 5xx

### Observable signal

- Route failure, backend-error, or upstream 5xx rates exceed baseline.
- Clients report `502`/`503`, or a backend's genuine 5xx response rate increases.
- Tail latency, timeouts, retries, or health transitions rise at the same time.

### Likely causes

- A backend application is returning genuine 5xx responses.
- A proxy-generated `502` reflects no route or upstream transport, TLS, or protocol failure.
- A proxy-generated `503` reflects unavailable backends, overload/prebuffer protection, an unavailable auth dependency, or fail-closed quota behavior.
- A proxy-generated `504` reflects an upstream, response-body, or external-authorization timeout.
- A recent runtime, backend, dependency, or network change regressed the request path.

### Read-only diagnostic checks

- Record exact status, response body, route, upstream, backend, and incident window.
- Compare `impulse_route_failure_total`, route backend errors/timeouts, upstream/backend outcomes, backend errors/timeouts, and latency.
- Check overload, quota-backend, health, TLS, DNS, and active-generation signals before assigning cause.
- Compare affected and unaffected routes/backends and review recent deployment and runtime history.

### Safe remediation

- Roll back the most strongly correlated runtime or backend change using its established rollback path.
- Isolate a failing backend, restore a dependency, or reduce traffic while preserving healthy/core traffic.
- Correct the identified route, transport, quota, or overload cause; do not widen unrelated limits.

### Escalation criteria

Escalate when the response cannot be classified, failures span healthy backends
without a correlated change, rollback does not reduce errors, or data integrity
or widespread customer impact is possible.

## Rate-limit or quota rejection

### Observable signal

- Clients receive `429`, `impulse_request_rate_limited` rises, or quota outcomes record denials.
- Denials increase while backend and overload signals remain healthy.
- A specific route, tenant, token, client, or other selector dimension is disproportionately affected.

### Likely causes

- A scoped local rate limit is exhausted.
- A quota policy's burst or sustained window is exhausted.
- Selector composition groups more traffic than intended or identity extraction changed.
- The distributed quota backend is degraded; its configured failure policy may instead produce a fail-closed `503` or local fallback behavior.

### Read-only diagnostic checks

- Query `impulse_request_rate_limited`, `impulse_quota_policy_outcomes_total`, and `impulse_quota_backend_health_total`.
- Inspect the active policies and quota-backend summary in `GET /admin/runtime`.
- Correlate policy, decision, reason, selector dimensions, backend mode, and caller identity without exposing tokens.
- Confirm whether demand changed and whether burst or sustained limits were reached.

### Safe remediation

- Ask clients to honor backoff when the configured contract is working as intended.
- Restore Redis/quota-backend health when distributed decisions are degraded.
- Correct selector extraction, scope, limits, or failure policy through `validate → preview → activate`.
- Keep quota remediation separate from overload-cap tuning.

### Escalation criteria

Escalate on unexpected identity collapse, inconsistent distributed decisions,
failure behavior that contradicts the configured fail-open/fail-closed/fallback
policy, or denials that continue after the responsible policy is corrected.

## Overload shedding

### Observable signal

- Clients receive protection-related `503` responses.
- `impulse_overload_shed` or `impulse_overload_shed_by_reason_total` rises, brownout becomes active, or connection/buffer/ingress drops increase.
- Active connections, inflight work, queues, memory, CPU, or backend latency approach their limits.

### Likely causes

- Connection, inflight, request-buffer, response-prebuffer, or ingress-queue limits are reached.
- Adaptive admission, circuit breaking, or brownout is protecting the process.
- Slow/unavailable backends retain work and amplify concurrency.
- Traffic or host capacity changed beyond the tested operating envelope.

### Read-only diagnostic checks

- Query overload reasons, brownout state, circuit rejects, active connections, connection-cap rejects, buffer use/rejects, and ingress queue/drop metrics.
- Correlate route overload counters with backend latency/errors and host CPU, RSS, file descriptors, socket buffers, and interface drops.
- Check whether shedding is localized by route/reason and whether it clears as pressure subsides.
- Review recent traffic, capacity, runtime, and backend changes.

### Safe remediation

- Reduce or shift demand, restore backend capacity, and preserve core routes first.
- Add already-provisioned capacity or roll back the change that created pressure.
- Tune a limit only after capacity testing shows the host and backend can sustain it; change one bounded control at a time.

### Escalation criteria

Escalate if shedding starts below the established baseline, does not clear after
pressure falls, causes OOM/resource exhaustion, or manifests as unexplained
silent ingress drops.

## Reload or activation failure

### Observable signal

- Validate/preview rejects a candidate, or activate/rollback returns an error.
- The active generation does not change after an attempted activation.
- Runtime rejection/activation metrics, history, logs, or audit events record failure.

### Likely causes

- The candidate is invalid, incompatible, or contains a restart-required change.
- `expected_generation` is stale because another actor activated a generation.
- A backend, TLS policy, or secret cannot be prepared before the atomic swap.
- A drain/restart gate or retained-history rule rejects the requested action.

### Read-only diagnostic checks

- Read the full validate/preview response, rejected domains, and restart-required fields.
- Read `GET /admin/runtime` and runtime history before and after the attempt.
- Query runtime validation, preview, activation, rollback, rejection, active-generation, and history-depth metrics.
- Inspect audit/log entries for actor, action, candidate source, expected generation, result, and reason; compare the candidate with the active sanitized config.

### Safe remediation

- Correct the rejected field and repeat `validate → preview → activate`.
- Refresh the active generation before retrying an optimistic-concurrency conflict.
- Use the rolling restart workflow for restart-required changes.
- If an activation succeeded but behavior regressed, roll back to a retained eligible generation and verify recovery.

### Escalation criteria

Escalate if a failed action changes the active generation, workers show partial
state, an atomic swap repeatedly returns an internal error, the process panics,
or runtime history and the active snapshot disagree.

## DNS/member churn

### Observable signal

- DNS refresh failures, address-set changes, or backend-client rotation failures rise.
- Backend membership or health flaps and failures follow resolved-address changes.
- The runtime retains stale members or connection attempts target unexpected addresses.

### Likely causes

- DNS is unavailable, slow, unstable, or returning empty/changing address sets.
- Resolver behavior or records changed more quickly than the configured refresh cadence.
- A client rotation after a valid address-set change failed, leaving stale pooled connections.
- Newly resolved members fail network, TLS, protocol, or health checks.

### Read-only diagnostic checks

- Query DNS refresh successes/failures, address-set changes, last success, resolved-address count, client rotations/failures, and per-address connect attempts.
- Compare the runtime backend inventory with `getent ahosts <name>` or an approved DNS query from the same host/network namespace.
- Correlate refresh and rotation timestamps with health transitions, TLS failures, and backend outcomes.
- Remember that a failed or empty refresh preserves the last usable address set; DNS success and client-rotation success are separate outcomes.

### Safe remediation

- Restore resolver reachability or stabilize the authoritative record.
- Correct an endpoint or refresh policy through `validate → preview → activate`.
- Reduce traffic to affected members while a valid address set and rotated clients are re-established.
- Verify new connections use the intended addresses before returning full traffic.

### Escalation criteria

Escalate when rotations repeatedly fail after valid DNS changes, runtime
membership diverges from retained resolution state, stale addresses cause
continued impact, or churn cannot be controlled at the DNS/service-discovery layer.

## Secret/certificate reload failure

### Observable signal

- `reload-certs` reports failure, the old downstream identity remains served, or secret reload/resolve metrics record errors.
- Runtime TLS/secret metadata shows a failed status or an unchanged load timestamp.
- Certificate-expiry metrics continue toward expiration after a planned rotation.

### Likely causes

- Material is missing, unreadable, malformed, non-atomic, or a certificate and key do not match.
- SNI/SAN coverage, client-auth CA, secret-reference path, or provider base directory is wrong.
- The wrong workflow was used: downstream listener content reload versus generation-owned upstream TLS material.
- The Control API listener's own certificate reload failed independently of a data-plane listener.

### Read-only diagnostic checks

- Read `GET /admin/runtime` TLS listener/upstream and secret metadata; it intentionally omits raw values.
- Query `impulse_secret_reload_total`, `impulse_secret_resolve_total`, `impulse_secret_last_success_unixtime`, certificate-expiry metrics, and `impulse_control_plane_cert_reload_total`.
- Inspect audit/log outcomes and file/path permissions with `namei -l` and `ls -l`.
- Decode certificate metadata and verify certificate/key correspondence without printing or copying secret bytes.

### Safe remediation

- Restore the previous known-good files atomically if the active rotation material is invalid.
- Correct least-privilege ownership/permissions and validate the complete certificate chain.
- Use `reload-certs` only for downstream material at active paths; use staged generation activation for upstream TLS and downstream path/policy changes.
- Keep the previous material available until the served identity, runtime metadata, and metrics confirm success.

### Escalation criteria

Escalate if a failed reload disrupts the previously active identity, old material
cannot be restored, expiry is imminent, secret resolution exposes material, or
private-key/credential compromise is suspected.

## Control API access failure

### Observable signal

- The Control API connection fails or returns TLS, `401`, `403`, `404`, or connection-limit errors.
- An authorized operator cannot read runtime state or perform an allowed action.
- Protected health/readiness probes fail while the data plane may remain healthy.

### Likely causes

- The client uses the wrong address, configured path, or protocol; the Control API is HTTP/1.1 over TLS.
- Bearer token, mTLS identity, role mapping, or required role is missing or invalid.
- The source is denied by the IP allowlist or trusted-proxy interpretation.
- The Control API listener is not bound, its TLS identity is invalid, or its connection limit is reached.

### Read-only diagnostic checks

- Confirm the configured socket with `ss -lntp`, then use `curl -v --http1.1` with the expected CA/SNI and credentials.
- Check the configured paths and whether health/readiness protection is enabled.
- Inspect control-plane TLS/authn/authz/allowlist logs and audit output without logging bearer tokens.
- Query connection-limit drops, audit drops/write failures, certificate-reload outcomes, and runtime state from another authorized operator path if available.

### Safe remediation

- Correct the client protocol, path, trust, certificate, token, role, or approved source address.
- Restore the Control API listener certificate through its documented rotation path.
- Resolve connection pressure at the caller and preserve the configured connection cap unless capacity evidence supports a change.
- If every admin path is locked out, use the organization's audited break-glass/rolling-restart procedure; do not expose the API publicly or disable authentication ad hoc.

### Escalation criteria

Escalate when all authorized identities are locked out, audit persistence fails,
token/key compromise is suspected, allowlist identity cannot be established
safely, or a control-plane failure begins affecting the data plane.

## Incident Bundle

Capture the smallest sanitized bundle that lets another operator reproduce the
classification. Health/readiness may require the same configured authentication
as other Control API reads.

```bash
curl --http1.1 --cacert <control-ca.pem> https://<control-host>:<port>/health
curl --http1.1 --cacert <control-ca.pem> https://<control-host>:<port>/ready
curl --http1.1 --cacert <control-ca.pem> -H "Authorization: Bearer <token>" \
  https://<control-host>:<port>/admin/runtime
curl --http1.1 --cacert <control-ca.pem> -H "Authorization: Bearer <token>" \
  https://<control-host>:<port>/admin/runtime/history
curl http://<metrics-host>:<port>/metrics
```

Also capture the incident time window, active generation, recent history,
affected route/upstream/backend, relevant metric slices, logs, audit events, and
the sanitized active configuration. Never attach bearer tokens, private keys,
raw secret values, or an unsanitized configuration.

## Related Pages

- [Operations Overview](/docs/operations/overview)
- [Reload and Drain](/docs/operations/reload-and-drain)
- [Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation)
- [Observability Operations](/docs/operations/observability)
- [Production Deployment](/docs/deployment/production)
