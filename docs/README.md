---
id: index
title: Impulse Documentation
slug: /
sidebar_position: 1
---

Impulse is a modern edge runtime for high-trust APIs. This documentation set is organized so readers can quickly answer five questions:

- what Impulse is
- where to start
- where to deploy and operate it
- where to troubleshoot issues
- where exact product reference lives

---

## Documentation Version

This documentation describes the Impulse v0.6 release family. Unless a page
explicitly labels historical or planned behavior, its statements apply to the
v0.6 configuration and runtime surfaces. Documentation for another release
family may differ.

## Documentation Authority

When a guide, example, overview, or runbook conflicts with a reference page,
use the assigned reference below and correct the conflicting page:

| Surface | Authoritative page |
| --- | --- |
| configuration keys, types, defaults, validation, and runtime meaning | [Configuration Reference](/docs/configuration/reference) |
| Control API endpoints, roles, requests, responses, and status semantics | [Control API Reference](/docs/reference/control-api-reference) |
| exported metric names, types, labels, and meanings | [Metrics Reference](/docs/reference/metrics-reference) |
| whether a capability is done, partial, or missing | [Feature Matrix](/docs/reference/feature-matrix) |
| hard product boundaries and non-goals | [Limitations](/docs/reference/limitations) |
| reader-facing product vocabulary | [Terminology](/docs/reference/terminology) |

Examples demonstrate valid deployment shapes, and operational pages explain
workflows. Neither redefines the contracts owned by the references above.

---

## Start Here

| Goal | Go to |
| --- | --- |
| Understand the product | [Project README](https://github.com/impulse-proxy/impulse#readme) |
| See Impulse proxy a request | [Quickstart](/docs/getting-started/quickstart) |
| Install Impulse on a host | [Installation](/docs/getting-started/installation) |
| Run the packaged container | [Docker](/docs/getting-started/docker) |
| Prepare for deployment | [Operations Overview](/docs/operations/overview) and [Production Deployment](/docs/deployment/production) |
| Troubleshoot issues | [Common Issues](/docs/troubleshooting/common-issues) and [Runbook](/docs/operations/runbook) |
| Find exact supported behavior | [Reference Overview](/docs/reference/overview) |

## Documentation Paths

### Operator — install, configure, run in production

| Document | What you'll find |
|---|---|
| [Quickstart](/docs/getting-started/quickstart) | One local backend, one minimal config, and one HTTP/3 request |
| [Installation](/docs/getting-started/installation) | Debian package and source installation paths |
| [Docker](/docs/getting-started/docker) | Packaged image availability, container contract, and Compose workflow |
| [Configuration Reference](/docs/configuration/reference) | Configuration schema entry point, with links to focused domain references |
| [Routing and Upstreams](/docs/configuration/routing-and-upstreams) | Exact route matching, upstream, backend, request-key, and load-balancing behavior |
| [Authentication and Secrets](/docs/configuration/authentication-and-secrets) | Downstream API-key, JWT, external-auth, OIDC, and secret-provider configuration |
| [TLS Setup](/docs/configuration/tls) | Certificate generation, mTLS client auth, key ownership and permissions |
| [Resilience, Rate Limits, and Quota](/docs/configuration/resilience) | Exact retry, hedge, circuit-breaker, admission, rate-limit, and quota configuration |
| [Observability and Control Configuration](/docs/configuration/observability-and-control) | Exact metrics, tracing, Control API security, audit, limits, and privilege-drop configuration |
| [Production Deployment](/docs/deployment/production) | Systemd unit, privilege drop, sysctl tuning, canary rollout guidance |
| [Production Readiness](/docs/operations/production-readiness) | Rollout assessment and operating guidance for the current beta release |
| [Operations Overview](/docs/operations/overview) | Main entry point for deployment, rollout, observability, and failure handling |
| [Troubleshooting](/docs/troubleshooting/common-issues) | Symptom-driven diagnostics and operator checks |
| [Limitations](/docs/reference/limitations) | The current hard product limits, without marketing language |

### Architecture — understand the runtime and subsystem ownership

| Document | What you'll find |
|---|---|
| [Architecture Overview](/docs/architecture/overview) | Architecture entry point, shared product flow, ingress model, and runtime boundaries |
| [Request Lifecycle](/docs/architecture/request-lifecycle) | Ownership from ingress validation through admission, routing, selection, transport, and outcome recording |
| [Runtime Generation and Configuration Lifecycle](/docs/architecture/runtime-generation) | Startup validation, staged activation, atomic generations, rollback, and shared-service ownership |
| [Transport and Backend Lifecycle](/docs/architecture/transport-and-backend-lifecycle) | Exact H1/H2 backend behavior, transport ownership, DNS, health, membership, and request feedback |
| [Distributed Quota Contract](/docs/architecture/quota-policy-contract) | Semantic contract for quota semantics, selector composition, and distributed counter behavior |
| [Codebase Map](/docs/development/codebase-map) | Current crate/module map and where major logic lives |
| [Development Invariants](/docs/development/invariants) | Core runtime invariants, ownership assumptions, and rules the code depends on |
| [Public API Surface Inventory](/docs/public-api-surface-inventory) | Current public surfaces, hidden internals, and remaining intentional exports |

### Control API and Operations — runtime control, observability, and failure handling

| Document | What you'll find |
|---|---|
| [API Overview](/docs/api/overview) | Metrics endpoint and Control API surfaces at a high level |
| [Observability and Control Configuration](/docs/configuration/observability-and-control) | Focused field reference for metrics, tracing, the Control API, and privilege dropping |
| [Control API Reference](/docs/reference/control-api-reference) | Endpoint-by-endpoint control API contract |
| [Metrics Reference](/docs/reference/metrics-reference) | Metric names, labels, and exported runtime signals |
| [Operations Overview](/docs/operations/overview) | Operator map for deployment, sizing, tuning, and failure handling |
| [Distributed Quota Operations](/docs/operations/distributed-quota) | Redis deployment, rollout, degraded-mode guidance, and incident interpretation |
| [Runbook](/docs/operations/runbook) | Day-2 operational procedures and troubleshooting flow |
| [Failure Modes](/docs/operations/failure-modes) | Expected degraded behaviors and what they mean operationally |
| [Sizing and Capacity](/docs/operations/sizing-and-capacity) | Capacity planning and scaling guidance |

### Protocol, traffic, and policy reference

| Document | What you'll find |
|---|---|
| [Routing and Upstreams](/docs/configuration/routing-and-upstreams) | Exact route precedence, backend selection, key extraction, and weight support |
| [Load Balancing](/docs/user-guide/load-balancing) | Operator guidance for choosing a balancing strategy |
| [HTTP/3](/docs/protocols/http3) | HTTP/3 behavior and protocol-specific operational notes |
| [QUIC](/docs/protocols/quic) | QUIC transport behavior, constraints, and terminology |
| [Security Model](/docs/concepts/security-model) | Current trust boundaries, admin-plane assumptions, and missing security layers |
| [Terminology](/docs/reference/terminology) | Preferred definitions for listener, route, upstream, backend, runtime generation, and lifecycle operations |

### Developer — contribute safely against the current architecture

| Document | What you'll find |
|---|---|
| [Contributing Guide](https://github.com/impulse-proxy/impulse/blob/master/CONTRIBUTING.md) | Dev setup, build commands, test matrix, PR conventions |
| [Development Overview](/docs/development/overview) | Contributor-oriented guide to working in the repo |
| [Testing Strategy](/docs/development/testing-strategy) | Contract, regression, and parity test expectations |
| [Benchmarking](/docs/development/benchmarking) | Local Criterion microbenchmarks for routing and load balancing |
| [Adding Features](/docs/development/adding-features) | Expectations for new features against the current architecture |

### Reference — schema, maturity, roadmap, and release state

| Document | What you'll find |
|---|---|
| [Reference Overview](/docs/reference/overview) | Map of exact behavior, product limits, and reference ownership |
| [Configuration Reference](/docs/configuration/reference) | Configuration schema authority for every configuration block |
| [Feature Matrix](/docs/reference/feature-matrix) | Feature-status authority for what is done, partial, and missing |
| [Roadmap](/docs/roadmap) | Planned features, GA exit criteria, known limitations |
| [Changelog](/docs/changelog) | Version history with added, fixed, and changed entries |

---

## Status

| Field | Value |
|---|---|
| Documentation target | Impulse v0.6 |
| Release maturity | Beta |
| License | GPLv3 |

Beta means core proxying, routing, load balancing, and health-check features are implemented and actively validated, but the project remains pre-GA — extended soak validation and broader failure-mode hardening are still in progress.

Controlled production rollout is supported. See [release-maturity.md](/docs/release-maturity) for operator expectations, environment guidance, and GA exit criteria.

---

## Quick reference

If you are in a hurry:

- first run: [getting-started/quickstart.md](/docs/getting-started/quickstart)
- production deployment: [deployment/production.md](/docs/deployment/production)
- incident response: [operations/runbook.md](/docs/operations/runbook)
- troubleshooting: [troubleshooting/common-issues.md](/docs/troubleshooting/common-issues)
- exact support surface: [reference/feature-matrix.md](/docs/reference/feature-matrix)

For starting examples and exact commands:

- working config snippets: [configuration/examples.md](/docs/configuration/examples)
- full config semantics: [configuration/reference.md](/docs/configuration/reference)
- Control API and metrics examples: [api/overview.md](/docs/api/overview)
- log levels and logging config: [configuration/reference.md](/docs/configuration/reference#logging-configuration)

---

## External standards

- [RFC 9000 — QUIC: A UDP-Based Multiplexed and Secure Transport](https://www.rfc-editor.org/rfc/rfc9000.html)
- [RFC 9114 — HTTP/3](https://www.rfc-editor.org/rfc/rfc9114.html)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html)
