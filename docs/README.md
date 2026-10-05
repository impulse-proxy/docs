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

## Start Here

| Goal | Go to |
| --- | --- |
| Understand the product | [Project README](https://github.com/impulse-proxy/impulse#readme) and [Getting Started Overview](/docs/getting-started/overview) |
| Install and run Impulse | [Getting Started](/docs/getting-started/overview) |
| Prepare for deployment | [Operations Overview](/docs/operations/overview) and [Production Deployment](/docs/deployment/production) |
| Troubleshoot issues | [Common Issues](/docs/troubleshooting/common-issues) and [Runbook](/docs/operations/runbook) |
| Find exact supported behavior | [Reference Overview](/docs/reference/overview) |

## Documentation Paths

### Operator — install, configure, run in production

| Document | What you'll find |
|---|---|
| [Installation](/docs/getting-started/installation) | Debian package, build from source, system requirements, TLS certificate layout |
| [Docker](/docs/getting-started/docker) | Container image, Compose bootstrap, smoke-test scripts |
| [Configuration Reference](/docs/configuration/reference) | Every config key, type, default, and constraint in one place |
| [TLS Setup](/docs/configuration/tls) | Certificate generation, mTLS client auth, key ownership and permissions |
| [Production Deployment](/docs/deployment/production) | Systemd unit, privilege drop, sysctl tuning, canary rollout guidance |
| [Production Readiness](/docs/operations/production-readiness) | Canonical statement of what is production-ready today and what still blocks GA |
| [Operations Overview](/docs/operations/overview) | Main entry point for deployment, rollout, observability, and failure handling |
| [Troubleshooting](/docs/troubleshooting/common-issues) | Symptom-driven diagnostics and operator checks |
| [Limitations](/docs/reference/limitations) | The current hard product limits, without marketing language |

### Architecture — understand the runtime and subsystem ownership

| Document | What you'll find |
|---|---|
| [Architecture Overview](/docs/architecture/overview) | Architecture entry point, shared product flow, ingress model, and runtime boundaries |
| [Request Lifecycle](/docs/architecture/request-lifecycle) | Canonical flow from intake through admission, routing, transport, and outcome recording |
| [Bootstrap vs QUIC](/docs/architecture/bootstrap-vs-quic) | Exact boundary between the native HTTP/3 path and the compatibility ingress path |
| [Transport Boundary](/docs/architecture/transport) | What transport owns, what edge owns, and how H1/H2 execution stays hidden behind one facade |
| [Backend Lifecycle](/docs/architecture/backend-lifecycle) | Backend identity, resolution, health, membership, and operator-visible lifecycle state |
| [Runtime Generation Model](/docs/architecture/runtime-generation) | How runtime reload, active generations, and shared services work |
| [Component Breakdown](/docs/architecture/components) | Per-crate responsibilities, inter-crate boundaries, key types |
| [Distributed Quota Contract](/docs/architecture/quota-policy-contract) | Semantic contract for quota semantics, selector composition, and distributed counter behavior |
| [Codebase Map](/docs/development/codebase-map) | Current crate/module map and where major logic lives |
| [Development Invariants](/docs/development/invariants) | Core runtime invariants, ownership assumptions, and rules the code depends on |
| [Public API Surface Inventory](/docs/public-api-surface-inventory) | Current canonical public surfaces, hidden internals, and remaining intentional exports |

### Control API and Operations — runtime control, observability, and failure handling

| Document | What you'll find |
|---|---|
| [API Overview](/docs/api/overview) | Metrics endpoint and Control API surfaces at a high level |
| [Control API Reference](/docs/reference/control-api-reference) | Endpoint-by-endpoint control API contract |
| [Metrics Reference](/docs/reference/metrics-reference) | Metric names, labels, and exported runtime signals |
| [Operations Overview](/docs/operations/overview) | Operator map for deployment, sizing, tuning, and failure handling |
| [Distributed Quota](/docs/operations/distributed-quota) | Distributed quota policy examples, Redis setup, degraded-mode guidance, and operator interpretation |
| [Runbook](/docs/operations/runbook) | Day-2 operational procedures and troubleshooting flow |
| [Failure Modes](/docs/operations/failure-modes) | Expected degraded behaviors and what they mean operationally |
| [Sizing and Capacity](/docs/operations/sizing-and-capacity) | Capacity planning and scaling guidance |

### Protocol, traffic, and policy reference

| Document | What you'll find |
|---|---|
| [Load Balancing](/docs/user-guide/load-balancing) | Current balancing strategies, selection behavior, and config examples |
| [HTTP/3](/docs/protocols/http3) | HTTP/3 behavior and protocol-specific operational notes |
| [QUIC](/docs/protocols/quic) | QUIC transport behavior, constraints, and terminology |
| [Security Model](/docs/concepts/security-model) | Current trust boundaries, admin-plane assumptions, and missing security layers |
| [Terminology](/docs/reference/terminology) | Canonical definitions for listener, upstream, backend, route, drain, and related terms |

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
| [Reference Overview](/docs/reference/overview) | Main entry point for exact behavior, product limits, and authoritative reference pages |
| [Configuration Reference](/docs/configuration/reference) | Authoritative schema reference for every configuration block |
| [Feature Matrix](/docs/reference/feature-matrix) | Strict feature-by-feature inventory of what is done, partial, and missing |
| [Roadmap](/docs/roadmap) | Planned features, GA exit criteria, known limitations |
| [Changelog](/docs/changelog) | Version history with added, fixed, and changed entries |

---

## Status

| Field | Value |
|---|---|
| Version | v0.6.0-beta |
| Maturity | Beta |
| License | GPLv3 |

Beta means core proxying, routing, load balancing, and health-check features are implemented and actively validated, but the project remains pre-GA — extended soak validation and broader failure-mode hardening are still in progress.

Controlled production rollout is supported. See [release-maturity.md](/docs/release-maturity) for operator expectations, environment guidance, and GA exit criteria.

---

## Quick reference

If you are in a hurry:

- first run: [getting-started/overview.md](/docs/getting-started/overview)
- production deployment: [deployment/production.md](/docs/deployment/production)
- incident response: [operations/runbook.md](/docs/operations/runbook)
- troubleshooting: [troubleshooting/common-issues.md](/docs/troubleshooting/common-issues)
- exact support surface: [reference/feature-matrix.md](/docs/reference/feature-matrix)

For the canonical examples and exact commands:

- working config snippets: [configuration/examples.md](/docs/configuration/examples)
- full config semantics: [configuration/reference.md](/docs/configuration/reference)
- Control API and metrics examples: [api/overview.md](/docs/api/overview)
- log levels and logging config: [configuration/reference.md](/docs/configuration/reference#logging-configuration)

---

## External standards

- [RFC 9000 — QUIC: A UDP-Based Multiplexed and Secure Transport](https://www.rfc-editor.org/rfc/rfc9000.html)
- [RFC 9114 — HTTP/3](https://www.rfc-editor.org/rfc/rfc9114.html)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html)
