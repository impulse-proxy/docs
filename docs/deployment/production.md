# Production Deployment

Impulse v0.7 is pre-GA software for controlled production rollout. Run it as a
pool behind a traffic manager, canary every change, and keep one previous binary
and configuration available. HTTP/1.1 and HTTP/2 ingress through Pingora are
the production path; HTTP/3 remains experimental.

This page owns the end-to-end operating sequence. Focused configuration,
endpoint, metric, rotation, and incident pages linked below own the details.

## Deployment Model

Each production node should have:

- one TLS listener reachable over TCP, plus UDP only when evaluating HTTP/3
- a Control API on loopback or an isolated administration network
- a metrics endpoint reachable only by the monitoring path
- centralized logs and durable administrative audit output
- enough spare fleet capacity for one node to drain

Prefer an unprivileged service account and a listener port above `1024`. If the
process binds port `443`, grant only `CAP_NET_BIND_SERVICE`. Size workers,
limits, buffers, and file descriptors from representative traffic; see
[Sizing and Capacity](/docs/operations/sizing-and-capacity).

## Deployment Profiles

Build selection controls which plugins exist in the binary. Configuration
controls which compiled plugins are active. See
[Plugin Build Profiles](/docs/configuration/plugin-builds) for the exact
feature contract.

### Minimal Reverse Proxy

This profile keeps connection-rate limiting and excludes authentication,
quota, cache, and compression plugins:

```bash
cargo build --release --locked -p impulse --bin impulse \
  --no-default-features \
  --features plugins-minimal
```

```yaml
version: 1

listen:
  address: "0.0.0.0"
  port: 8443
  tls:
    cert: "/etc/impulse/tls/server.crt"
    key: "/etc/impulse/tls/server.key"

upstream:
  default:
    route:
      path_prefix: "/"
    backends:
      - id: "app-1"
        address: "https://app.internal.example:8443"

performance:
  connection_rate_limit_enabled: true
  new_connections_per_sec: 2000
  new_connections_burst: 500

observability:
  metrics:
    enabled: true
    required: true
    address: "127.0.0.1"
    port: 9901
```

Without the Control API, configuration changes require a drain-aware process
restart. This is the smallest operational shape, not the recommended shape for
frequently changed fleets.

### Full Compatibility Deployment

The default build includes all v0.7 plugin kinds. It does not activate them
unless configuration requires them.

```bash
cargo build --release --locked -p impulse --bin impulse
```

```yaml
version: 1

listen:
  address: "0.0.0.0"
  port: 8443
  tls:
    cert: "/etc/impulse/tls/server.crt"
    key: "/etc/impulse/tls/server.key"

secrets:
  default_provider: runtime_files
  providers:
    runtime_files:
      kind: file
      base_dir: "/run/impulse/secrets"

upstream:
  default:
    route:
      path_prefix: "/"
    load_balancing:
      type: round-robin
    cache:
      enabled: true
      max_bytes: 67108864
      max_entries: 10000
      max_object_bytes: 1048576
      max_ttl_secs: 300
    compression:
      enabled: true
      minimum_size_bytes: 1024
    backends:
      - id: "app-a"
        address: "https://app-a.internal.example:8443"
        health_check:
          path: "/ready"
          interval: 5000
          timeout_ms: 1000
          failure_threshold: 3
          success_threshold: 2
          cooldown_ms: 5000
      - id: "app-b"
        address: "https://app-b.internal.example:8443"
        health_check:
          path: "/ready"
          interval: 5000
          timeout_ms: 1000
          failure_threshold: 3
          success_threshold: 2
          cooldown_ms: 5000

performance:
  backend_dns_refresh_enabled: true
  backend_dns_refresh_interval_ms: 30000

observability:
  metrics:
    enabled: true
    required: true
    address: "127.0.0.1"
    port: 9901
  control_api:
    enabled: true
    required: true
    address: "127.0.0.1"
    port: 9902
    auth:
      bearer_tokens:
        - token_ref:
            ref: "file://control-api.token"
          role: admin
          actor_id: "ops-automation"
```

This example activates cache and compression only. Add authentication, scoped
limits, or quota when the route requires them; do not enable every compiled
plugin merely because it is available. Field definitions belong in the
[Configuration Reference](/docs/configuration/reference).

## Startup and Shutdown

Start the process with one explicit configuration source:

```bash
/usr/local/bin/impulse --config /etc/impulse/config.yaml
```

Startup loads and validates configuration, resolves required files and secrets,
checks compiled plugin availability, prepares the first complete runtime
generation, and binds required services. A valid configuration keeps the
process running; there is no validate-and-exit mode. An invalid explicit
configuration exits with status `1`. Omitting `--config` when the default
`/etc/impulse/config.yaml` is absent exits with status `2`.

Do not send traffic until readiness succeeds. A successful process start alone
does not prove backend reachability, certificate freshness, route intent, or
capacity.

On `SIGTERM` or `SIGINT`, Impulse stops admitting new work, marks readiness
accordingly, drains active work up to `performance.shutdown_drain_timeout_ms`,
then closes remaining connections and exits. The service manager's stop timeout
must exceed that drain budget.

A minimal systemd service needs these lifecycle properties:

```ini
[Service]
Type=simple
User=impulse
Group=impulse
ExecStart=/usr/local/bin/impulse --config /etc/impulse/config.yaml
Restart=on-failure
RestartSec=5s
TimeoutStopSec=15s
LimitNOFILE=1048576
NoNewPrivileges=true
```

Use `systemctl stop impulse` for a graceful stop. Do not send `SIGKILL` unless
the bounded drain and service-manager timeout have both failed.

## Activation, Rollback, and Draining

Impulse publishes complete immutable generations; it does not patch live state
in place. Existing requests retain their pinned generation while new requests
use the newly active generation.

For runtime-managed changes:

1. `POST /admin/runtime/validate`
2. `POST /admin/runtime/preview`
3. Inspect `candidate_status` and `rejected_changes`; HTTP `200` alone is not
   acceptance.
4. `POST /admin/runtime/activate` with `expected_generation`.
5. Confirm the active generation, runtime history, backend state, and metrics.

A preparation or activation failure leaves the active generation unchanged.
If behavior regresses, choose an eligible target from
`GET /admin/runtime/history` and call `POST /admin/runtime/rollback` with
`expected_active_generation`. Rollback publishes another generation; history
is bounded and is not a durable backup of files or binaries.

| Change | Required path |
| --- | --- |
| Routes, upstreams, policies, runtime limits, or `log.level` | Validate, preview, activate |
| Downstream certificate content at active paths | `POST /admin/runtime/reload-certs` |
| Listener removal or bind change, operational listener bind, logging sink/format, tracing startup settings, or control-plane thread count | Drain-aware restart or node replacement |
| Binary or Cargo feature set | Canary replacement, then node-by-node drain |

Activation changes generations. Draining changes process lifecycle. Never use
activation as a substitute for draining a node before restart.

Detailed contract: [Reload and Drain](/docs/operations/reload-and-drain).

## TLS and Certificate Rotation

Choose the rotation path by ownership:

| Material | Rotation path |
| --- | --- |
| Downstream certificate/key or client-auth CA content at unchanged paths | Replace atomically, then `reload-certs` |
| Downstream path, SNI mapping, or client-auth policy | Validate, preview, activate, then `reload-certs` |
| Upstream CA, verification policy, client certificate, or client key | Validate, preview, activate |

Listener reload stages all active identities and installs none if any identity
fails. It affects new handshakes only; established sessions retain their TLS
state. Upstream TLS is generation-owned and rotates backend connection pools.

Runtime rollback restores retained resolved secret material, but it does not
restore overwritten files. Keep the previous files until new downstream and
upstream handshakes are verified.

Detailed procedure:
[Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation).

## Backend Health and DNS Failure Behavior

Active health checks apply configured success and failure thresholds, timeout,
and cooldown before changing readiness. Passive request failures remain a
separate signal but can also remove a backend from selection. Selection never
sends a request to a backend currently marked unavailable.

When DNS refresh is enabled:

- a successful non-empty result publishes new generation-owned membership
- a failed, timed-out, or empty lookup retains the last-known-good membership
- results from retired runtime generations are ignored
- selector rebuild or backend-client rotation failure retains the usable view
  and is reported independently from DNS success

If no eligible backend remains, the request fails instead of bypassing health
state. During an incident, compare active and passive health, DNS refresh,
resolved membership, TLS failures, and request outcomes before changing
thresholds or retry policy.

Configuration: [Routing and Upstreams](/docs/configuration/routing-and-upstreams).
Diagnosis: [Operations Runbook](/docs/operations/runbook#backend-unavailable).

## Runtime Status and Metrics

Use the Control API for current state and metrics for trends:

- `GET /health` reports process health.
- `GET /ready` reports whether the instance should receive traffic.
- `GET /admin/runtime` reports the active generation, compiled and active
  plugins, listeners and TLS inventory, backend membership and health, quota,
  watchdog, and bounded lifecycle status.
- `GET /admin/runtime/history` reports retained generations and rollback
  eligibility.
- the configured metrics endpoint exports request, connection, admission,
  backend, DNS, TLS, plugin, activation, drain, and process signals.

At minimum, alert on readiness loss, request failure and latency, absence of
eligible backends, DNS staleness, TLS expiry or reload failure, activation
rejection, connection/admission pressure, and drain timeout. Correlate every
change or incident with the active generation; do not infer current state from
metrics alone.

Exact contracts: [Control API Reference](/docs/reference/control-api-reference),
[Metrics Reference](/docs/reference/metrics-reference), and
[Observability Operations](/docs/operations/observability).

## Rollout and Validation

`impulse --config` starts the service, so validate startup on isolated binds or
an isolated node. For a running full deployment, use the staged Control API
flow. Before sending traffic:

1. Confirm the service account can read configuration, certificates, CAs, and
   secret files.
2. Verify TCP reachability and, only when used, UDP reachability independently.
3. Check backend DNS, network, TLS, and health paths from the node.
4. Confirm health, readiness, metrics, logs, and audit output.
5. Record the active generation, previous config, previous binary, and rollback
   owner.

Canary one node or bounded traffic slice. Compare errors, latency, overload,
backend health, DNS, TLS, resource use, and policy outcomes with the unchanged
pool. Expand only while predeclared thresholds remain healthy.

## Production Checklist

- [ ] One team owns configuration, TLS, rollout, and incident decisions.
- [ ] The chosen binary profile contains every plugin required by configuration.
- [ ] Control and metrics listeners are isolated from public traffic.
- [ ] Capacity and service-manager limits were tested with representative load.
- [ ] Startup, graceful shutdown, activation, rollback, and certificate rotation
      were rehearsed for the selected profile.
- [ ] The previous binary, configuration, and TLS material remain recoverable.
- [ ] Dashboards, alerts, logs, and audit output are visible before canary traffic.
- [ ] HTTP/3 traffic, if enabled, is treated as experimental and measured separately.

## Related Pages

- [Status and Limitations](/docs/reference/status-and-limitations)
- [Configuration Reference](/docs/configuration/reference)
- [Reload and Drain](/docs/operations/reload-and-drain)
- [Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation)
- [Sizing and Capacity](/docs/operations/sizing-and-capacity)
- [Operations Runbook](/docs/operations/runbook)
