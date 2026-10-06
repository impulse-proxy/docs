# API Overview

This page is the short map for Impulse's operator-facing programmatic surfaces.

Use the linked reference pages for canonical endpoint behavior, status codes, metrics, and configuration semantics.

## CLI Surface

Basic usage:

```bash
impulse --config /etc/impulse/config.yaml
```

Core options:

| Option | Meaning |
| --- | --- |
| `--config` / `-c` | Path to config file |
| `--version` / `-V` | Print version |
| `--help` / `-h` | Print usage |

## Surface Map

| Surface | Protocol | Main use | Authoritative page |
| --- | --- | --- | --- |
| metrics endpoint | HTTP `GET` | scrape, dashboarding, alerting, trend analysis | [Metrics Reference](/docs/reference/metrics-reference) |
| Control API | HTTP/1.1 over TLS | runtime state, staged activation, rollback, cert reload, restart | [Control API Reference](/docs/reference/control-api-reference) |
| config file | YAML | runtime configuration input | [Configuration Reference](/docs/configuration/reference) |

## Common Entry Points

| Task | Start here |
| --- | --- |
| check process liveness and readiness | `GET /health` and `GET /ready` in [Control API Reference](/docs/reference/control-api-reference) |
| inspect active runtime state | `GET /admin/runtime` in [Control API Reference](/docs/reference/control-api-reference) |
| validate, preview, activate, or roll back runtime config | [Control API Reference](/docs/reference/control-api-reference) |
| understand metric names and labels | [Metrics Reference](/docs/reference/metrics-reference) |
| use dashboards, alerts, and SLO views | [Observability Operator Bundle](/docs/operations/observability-bundle) |
| understand reload, drain, and restart boundaries | [Reload and Drain](/docs/operations/reload-and-drain) |
| understand exact config shape and examples | [Configuration Reference](/docs/configuration/reference) and [Configuration Examples](/docs/configuration/examples) |

## Scope Note

The Control API is a file-reload control surface, not a granular per-object mutation API.

For the canonical behavior of:

- `validate`, `preview`, `activate`, `rollback`, `reload`, `reload-certs`, and `restart`
- generation history and rollback eligibility
- authn, authz, and mTLS behavior
- response status and failure semantics

use [Control API Reference](/docs/reference/control-api-reference).

For runtime-managed versus restart-required configuration boundaries, use [Reload and Drain](/docs/operations/reload-and-drain).

## Related Pages

- [Control API Reference](/docs/reference/control-api-reference)
- [Metrics Reference](/docs/reference/metrics-reference)
- [Configuration Reference](/docs/configuration/reference)
- [Observability Operator Bundle](/docs/operations/observability-bundle)
- [Operations Runbook](/docs/operations/runbook)
