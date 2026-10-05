# Operations Overview

This section is the main entry point for deploying, rolling out, operating, and recovering Impulse in production.

Use it to answer where Impulse fits well today, how to prepare hosts and capacity, how to roll out config and binary changes safely, and where to look during an incident.

## Start Here

| Goal | Document |
|---|---|
| Decide whether the current release is ready for your environment | [Production Readiness](/docs/operations/production-readiness) |
| Prepare a production host and service layout | [Production Deployment](/docs/deployment/production) |
| Understand safe activation, restart-required changes, drain, and rollback | [Reload and Drain](/docs/operations/reload-and-drain) |
| Plan host sizing and concurrency limits | [Sizing And Capacity](/docs/operations/sizing-and-capacity) |
| Tune the host OS and runtime environment | [Host Tuning](/docs/operations/host-tuning) |
| Choose a rollout shape | [Deployment Patterns](/docs/operations/deployment-patterns) |
| Validate before and after a change | [Validation](/docs/deployment/validation) |
| Troubleshoot incidents quickly | [Runbook](/docs/operations/runbook) |
| Interpret visible failures and status codes | [Failure Modes](/docs/operations/failure-modes) |
| Operate distributed quota safely | [Distributed Quota](/docs/operations/distributed-quota) |
| Use the shipped dashboards, alerts, and SLO views | [Observability Operator Bundle](/docs/operations/observability-bundle) |

## Canonical Sources By Topic

Use this page for workflow and navigation. Use the pages below for authoritative detail:

| Topic | Canonical page |
| --- | --- |
| exact Control API endpoint behavior | [Control API Reference](/docs/reference/control-api-reference) |
| exact metric names and labels | [Metrics Reference](/docs/reference/metrics-reference) |
| exact configuration shape and runtime semantics | [Configuration Reference](/docs/configuration/reference) |
| symptom-driven incident diagnosis | [Troubleshooting](/docs/troubleshooting/common-issues) |
| runtime protection dashboards, alerts, and SLOs | [Observability Operator Bundle](/docs/operations/observability-bundle) |

## Core Operating Model

Impulse has three distinct change paths:

1. Runtime-managed config changes
   Use the Control API staged flow: `validate`, `preview`, then `activate`. This is the normal path for routes, upstreams, backends, timeouts, resilience policy, and other live-reloadable runtime state.
2. Certificate-only changes
   Use `POST /admin/runtime/reload-certs`. This updates listener TLS material for new handshakes only.
3. Restart-required changes
   Use a drain-aware restart or instance replacement workflow when the change affects startup-owned state such as listener bind changes, control-plane bind changes, tracing startup settings, or logging sink configuration.

Do not treat all changes as restarts, and do not treat all changes as live-reloadable.

## Common Workflows

### Deploy a new environment

Start with:

- [Production Readiness](/docs/operations/production-readiness)
- [Production Deployment](/docs/deployment/production)
- [Host Tuning](/docs/operations/host-tuning)
- [Sizing And Capacity](/docs/operations/sizing-and-capacity)

### Roll out a runtime config change

Start with:

- [Validation](/docs/deployment/validation)
- [Reload and Drain](/docs/operations/reload-and-drain)
- [Runbook](/docs/operations/runbook)

### Roll out a binary upgrade or restart-required config change

Start with:

- [Deployment Patterns](/docs/operations/deployment-patterns)
- [Production Deployment](/docs/deployment/production)
- [Reload and Drain](/docs/operations/reload-and-drain)

### Investigate production failures

Start with:

- [Runbook](/docs/operations/runbook)
- [Failure Modes](/docs/operations/failure-modes)
- [Observability Operator Bundle](/docs/operations/observability-bundle)
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
