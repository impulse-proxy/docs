# Operations Overview

This section is the main entry point for deploying, rolling out, operating, and recovering Impulse in production.

Use it to answer where Impulse fits well today, how to prepare hosts and capacity, how to roll out config and binary changes safely, and where to look during an incident.

## Start Here

| Goal | Document |
|---|---|
| Assess readiness and prepare a production deployment | [Production Deployment](/docs/deployment/production) |
| Understand safe activation, restart-required changes, drain, and rollback | [Reload and Drain](/docs/operations/reload-and-drain) |
| Plan capacity and tune the host runtime | [Capacity Planning and Host Tuning](/docs/operations/sizing-and-capacity) |
| Choose, validate, and execute a rollout | [Rollout and Validation](/docs/deployment/production#rollout-and-validation) |
| Troubleshoot incidents quickly | [Runbook](/docs/operations/runbook) |
| Interpret visible failures and status codes | [Failure Modes](/docs/operations/failure-modes) |
| Operate distributed quota safely | [Distributed Quota](/docs/operations/distributed-quota) |
| Use the shipped dashboards, alerts, and SLO views | [Observability Operations](/docs/operations/observability) |

## Reference Ownership

This page owns operational navigation and workflow guidance; it does not redefine
configuration, API, metrics, feature-status, or limitation contracts. Use the
[Reference Overview](/docs/reference/overview) for the authority assigned to
each product surface. Use [Troubleshooting](/docs/troubleshooting/common-issues)
for symptom-driven diagnosis and the
[Observability Operations](/docs/operations/observability) for
dashboard, alert, and SLO guidance.

## Core Operating Model

Impulse has three distinct change paths:

1. Runtime-managed config changes
   Use the Control API staged flow: `validate`, `preview`, then `activate`. This is the normal path for routes, upstreams, backends, timeouts, resilience policy, and other state eligible for live activation.
2. Certificate-only changes
   Use `POST /admin/runtime/reload-certs`. This updates listener TLS material for new handshakes only.
3. Restart-required changes
   Use a drain-aware restart or instance replacement workflow when the change affects startup-owned state such as listener bind changes, control-plane bind changes, tracing startup settings, or logging sink configuration.

Do not treat all changes as restarts, and do not assume every change is eligible for live activation.

## Common Workflows

### Deploy a new environment

Start with:

- [Production Deployment](/docs/deployment/production)
- [Capacity Planning and Host Tuning](/docs/operations/sizing-and-capacity)

### Roll out a runtime config change

Start with:

- [Rollout and Validation](/docs/deployment/production#rollout-and-validation)
- [Reload and Drain](/docs/operations/reload-and-drain)
- [Runbook](/docs/operations/runbook)

### Roll out a binary upgrade or restart-required config change

Start with:

- [Production Deployment](/docs/deployment/production)
- [Reload and Drain](/docs/operations/reload-and-drain)

### Investigate production failures

Start with:

- [Runbook](/docs/operations/runbook)
- [Failure Modes](/docs/operations/failure-modes)
- [Observability Operations](/docs/operations/observability)
- [Troubleshooting](/docs/troubleshooting/common-issues)

## Operator Rules

- Keep the Control API on loopback or a strongly isolated admin network.
- Use `--http1.1` for all `curl` calls to the Control API.
- Prefer `validate` and `activate` over the legacy `reload` shortcut in production automation.
- Pass `expected_generation` on activation and rollback workflows so concurrent changes fail safely.
- Keep at least one known-good rollback target and one known-good binary available during every rollout.
- Treat quota denials and overload shedding as separate operational signals.

## Related Pages

- [API Overview](/docs/api/overview)
- [Control API Reference](/docs/reference/control-api-reference)
- [Metrics Reference](/docs/reference/metrics-reference)
- [Troubleshooting](/docs/troubleshooting/common-issues)
