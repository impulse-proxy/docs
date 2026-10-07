# Production Deployment

Impulse v0.6 is beta software intended for controlled production rollout. This
guide owns the production host, service, validation, rollout, and readiness
workflow. Exact maturity, capability status, and product boundaries remain in
[Status and Limitations](/docs/reference/status-and-limitations).

Day-two diagnosis and recovery belong in the
[Operations Runbook](/docs/operations/runbook), not in this deployment guide.

## Production Readiness and Fit

Impulse is a good fit when:

- HTTP/3 terminates at the edge and services use HTTP/2, HTTP/1.1, or both
- one accountable team owns configuration, TLS, rollout, and incidents
- configuration is file-backed and changed through controlled automation
- every change can start with a canary or bounded traffic slice
- metrics, logs, health, readiness, and rollback are available before traffic
  expands

It is a weaker fit for a highly dynamic multi-tenant control plane, broad
legacy-protocol compatibility, deep service-mesh discovery, or a full API
gateway replacement. Review the current limitations before selecting it for
those roles.

Do not move beyond a controlled slice until rollback has been exercised,
Control API access is protected, dashboards and alerts are live, and the team
can distinguish runtime-managed changes from restart-required changes.

## Deployment Shape

The recommended production shape is an active-active pool behind a traffic
manager that supports both TCP and UDP on the listener port. Each node should
have:

- one public listener exposed over UDP for HTTP/3 and TCP for bootstrap
  HTTP/1.1/HTTP/2
- a Control API bound to loopback or an isolated administration network
- a metrics endpoint reachable only by the monitoring path
- centralized logs and durable Control API audit output
- enough spare capacity for another node to drain or leave service

Use a canary or bounded traffic slice for ordinary changes. Use blue-green or
node replacement for binary upgrades and restart-required changes when that is
safer than mutating a node in place. A single-node deployment has no
availability during restart and should not be treated as the production
baseline.

## Host and Service Layout

Use Linux for production. Size CPU, memory, socket buffers, queues, and file
descriptors from measured traffic rather than treating a generic host shape as
a capacity guarantee. See
[Capacity Planning and Host Tuning](/docs/operations/sizing-and-capacity).

Recommended paths and ownership:

| Path | Owner and mode | Purpose |
| --- | --- | --- |
| `/usr/local/bin/impulse` | `root:root`, `0755` | Versioned or atomically replaced binary |
| `/etc/impulse/` | `root:impulse`, `0750` | Operator-owned configuration tree |
| `/etc/impulse/config.yaml` | `root:impulse`, `0640` | Active configuration source |
| `/etc/impulse/candidate.yaml` | `root:impulse`, `0640` | Staged candidate configuration |
| `/etc/impulse/certs/` | `root:impulse`, `0750` | Certificates, keys, and trust material |
| `/var/lib/impulse/` | `impulse:impulse`, `0750` | Runtime-owned state when required |
| `/var/log/impulse/` | `impulse:impulse`, `0750` | File logs or audit output when configured |

Keep one configuration owner. Deployment automation should render a complete
candidate, set its ownership and permissions, and then validate that exact
file. A successful activation with an alternate `config_path` makes that path
the active source for later reload operations; do not let temporary paths or
multiple writers become accidental sources of truth.

Keep the current and previous known-good binary, the active config, and one
reviewed rollback config available throughout a rollout. Record artifact
checksums or equivalent provenance in the deployment system.

## Privileges

Prefer running the service as the unprivileged `impulse` user. Bind a port at
or above `1024` behind the traffic manager when possible. If the process must
bind port `443` directly, grant only `CAP_NET_BIND_SERVICE`; do not grant broad
capabilities.

Impulse also supports an internal post-bind privilege drop:

```yaml
security:
  privileges:
    enabled: true
    user: impulse
    group: impulse
```

This drop occurs only when the process starts with effective UID `0`. It is a
no-op when systemd already starts the process as `User=impulse`. Choose one
deliberate model:

- start as `impulse`, using a high port or `CAP_NET_BIND_SERVICE`; or
- start as root solely to bind, keep privilege dropping enabled, and verify the
  configured user and group exist

In both models, the final service identity needs read access to active and
candidate configs, certificates, keys, certificate authority (CA) files, and secret files used during
activation or reload. It needs write access only to configured runtime, log,
and audit paths. See
[Observability and Control Configuration](/docs/configuration/observability-and-control#privilege-dropping)
for the exact fields and failure behavior.

## systemd Service

The following unit uses the preferred unprivileged model and assumes the public
listener binds above `1024`:

```ini
[Unit]
Description=Impulse edge runtime
Documentation=https://github.com/impulse-proxy/impulse
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=impulse
Group=impulse
ExecStart=/usr/local/bin/impulse --config /etc/impulse/config.yaml
Restart=on-failure
RestartSec=5s
LimitNOFILE=1048576
LimitNPROC=16384
TasksMax=16384
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/impulse /var/log/impulse
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
StandardOutput=journal
StandardError=journal
SyslogIdentifier=impulse

[Install]
WantedBy=multi-user.target
```

For direct binding below `1024`, add both of these lines and retain the
unprivileged `User` and `Group`:

```ini
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
```

Review hardening directives against configured file, secret, audit, tracing,
DNS, and network access. Verify the rendered unit with
`systemd-analyze security impulse.service` and test it in the target
environment before rollout.

`systemctl reload` is not the configuration change path. Use the Control API
for runtime generations, `reload-certs` for downstream certificate-only
changes, and a drain-aware restart or node replacement for startup-owned
changes.

## Certificates and Secrets

Before deployment, verify that:

- certificate SANs cover every served hostname
- certificate and private-key public keys match
- expiry alerts provide enough rotation lead time
- the final service identity can read every referenced file
- previous material remains recoverable until new handshakes are verified

For downstream certificate-only rotation, replace material safely and call
`POST /admin/runtime/reload-certs`; existing sessions keep their current TLS
state. Upstream client certificates, upstream CA changes, and other
generation-owned secrets use `validate → preview → activate`, not
`reload-certs`. Follow
[Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation)
for the complete rotation and rollback contract.

## Change Paths

Classify every deployment before changing a node:

| Change | Production path |
| --- | --- |
| Routes, upstreams, backends, runtime policy, timeouts, or `log.level` | `validate → preview → activate` |
| Downstream listener certificate material only | `POST /admin/runtime/reload-certs` |
| Listener removal or bind change, metrics/Control API bind change, tracing startup settings, logging sink/format, or control-plane thread count | Drain-aware restart or node replacement |
| Binary upgrade | Canary node followed by node-by-node or blue-green replacement |

Preview or activation may classify additional differences as restart-required.
Treat the returned plan as authoritative for that candidate; never assume a
field can activate live merely because a previous change did.

## Rollout and Validation

### Safe Configuration Validation

`impulse --config` starts the server. A valid config proceeds to runtime
initialization and listener binding; it does not validate and exit. Use one of
these workflows:

1. **Controlled startup.** Copy the candidate to an isolated host or change
   every listener, metrics, and Control API binding to non-production addresses
   and ports. Start it with `impulse --config <path>`, require the
   listening/ready state, then stop it. An unreadable or invalid explicit config
   exits with status `1`; a valid config remains running, so its eventual exit
   status after operator shutdown is not a validation result.
2. **Staged Control API.** On a secured validation or target instance, call
   `POST /admin/runtime/validate`, then `/preview`, then `/activate`. Validate
   and preview do not publish the candidate. Their HTTP `200` responses can
   still contain rejected changes, so require an acceptable `candidate_status`
   and empty `rejected_changes` before activation.

Use the [Control API Reference](/docs/reference/control-api-reference) for
request bodies, roles, response fields, and status codes.

Startup validation catches schema, normalization, and required startup-resource
errors. It does not prove backend reachability, certificate freshness, route
intent, capacity, or behavior under real traffic. Check those separately.

### Pre-Rollout Verification

Before sending traffic to a candidate:

1. Review the complete config diff and identify its change path.
2. Confirm the candidate file, certificates, keys, CAs, and secrets are readable
   by the final service identity.
3. Check certificate expiry, SAN coverage, and key pairing.
4. Test backend DNS, network reachability, TLS expectations, and configured
   health paths from the target node.
5. Review host/path/method route overlaps and representative expected matches.
6. Confirm public listener, metrics, and Control API bindings and firewall
   separation.
7. Confirm metrics scraping, log shipping, audit output, health, and readiness.
8. Record the active generation and verify the chosen rollback target or
   previous binary.

### Canary Rollout

Use a separate node or isolated listener bindings; never start a second process
against production bindings merely to validate it.

1. Deploy the candidate to one node or bounded traffic slice.
2. Require health and readiness before adding traffic.
3. Begin with a small weight appropriate to the risk and traffic volume.
4. Compare route success/failure, latency, overload, quota, auth, backend
   health, connection pressure, and resource use with the unchanged pool.
5. Hold long enough to cover meaningful traffic and background health/DNS work.
6. Expand in controlled increments only while the candidate stays within the
   predeclared acceptance thresholds.

Do not use a fixed ten-minute observation period as proof of safety. Set the
window and thresholds from request volume, error budget, retry behavior,
certificate/DNS refresh intervals, and the specific risk of the change.

### Activation and Rollback

For a runtime-managed candidate, pass `expected_generation` to activation so a
concurrent change fails with `409`. After activation, confirm the returned and
active generation, runtime history, backend state, and primary dashboards
before expanding traffic.

If a live activation regresses behavior, choose a retained candidate from
`GET /admin/runtime/history` and call `POST /admin/runtime/rollback` with
`expected_active_generation`. Rollback publishes a new generation and retained
history is bounded; it does not replace binary rollback or a saved config.

For a binary or restart-required regression, remove the node from traffic,
restore the previous binary and config as applicable, restart, revalidate, and
return it only after health and readiness recover. See
[Reload and Drain](/docs/operations/reload-and-drain) for exact lifecycle
semantics.

### After Deployment

Verify the active generation and watch the shipped dashboards and alerts for
the complete observation window. If health, readiness, latency, error rate,
overload, quota, auth, backend health, TLS, ingress drops, or resource use
crosses an acceptance threshold, stop expansion and roll back.

Use [Observability Operations](/docs/operations/observability) for signal
interpretation. Use the [Operations Runbook](/docs/operations/runbook) for
day-two incidents and recovery; do not debug an unexplained regression while
continuing rollout.

## Production Checklist

### Ownership and Rollback

- [ ] A single team owns config, TLS, rollout, and incident decisions.
- [ ] The candidate diff and change classification were reviewed.
- [ ] The active generation, retained rollback target, previous config, and
      previous binary are recorded.
- [ ] Canary acceptance thresholds and rollback authority are explicit.

### Host and Service

- [ ] Capacity and host tuning were validated with representative traffic.
- [ ] UDP and TCP reachability is available on the public listener port.
- [ ] File-descriptor, task, socket-buffer, and queue limits are sufficient.
- [ ] The systemd unit, restart policy, writable paths, and hardening were tested.
- [ ] The process ends startup as the intended unprivileged identity with only
      required capabilities.

### Security-Model Review

- [ ] Every boundary in the [Security Model](/docs/concepts/security-model#trust-boundary-map)
      was reviewed, and any deviation from its hardening baseline was approved.
- [ ] The candidate's exact authentication, TLS, control-plane, secret, and
      upstream behavior was verified against the linked configuration authorities.

### Rollout and Operations

- [ ] Safe validation completed without using production bindings.
- [ ] Metrics, dashboards, alerts, logs, traces, and audit records are visible.
- [ ] Runtime activation, certificate reload, restart/drain, and rollback paths
      have been rehearsed as applicable.
- [ ] The canary completed its full observation window within thresholds.
- [ ] The incident owner knows when to stop expansion and use the runbook.

## Related Pages

- [Installation](/docs/getting-started/installation)
- [Protocol Support](/docs/protocols/support)
- [Reload and Drain](/docs/operations/reload-and-drain)
- [Capacity Planning and Host Tuning](/docs/operations/sizing-and-capacity)
- [Observability Operations](/docs/operations/observability)
- [Operations Runbook](/docs/operations/runbook)
- [Security Model](/docs/concepts/security-model)
