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
| release maturity, capability status, partial-support boundaries, and limitations | [Status and Limitations](/docs/reference/status-and-limitations) |
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
| Prepare for deployment | [Production Deployment](/docs/deployment/production) |
| Troubleshoot issues | [Operations Runbook](/docs/operations/runbook) |
| Check maturity and product limits | [Status and Limitations](/docs/reference/status-and-limitations) |
| Find exact supported behavior | [Documentation Authority](#documentation-authority) and [Status and Limitations](/docs/reference/status-and-limitations) |

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
| [Production Deployment](/docs/deployment/production) | Readiness, systemd, privileges, configuration ownership, validation, rollout, rollback, and production checklist |
| [Operations Runbook](/docs/operations/runbook) | Symptom-driven diagnostics, safe remediation, and escalation criteria |
| [Status and Limitations](/docs/reference/status-and-limitations) | Release maturity, capability status, partial-support boundaries, GA blockers, and product limits |

### Architecture — understand the runtime and subsystem ownership

| Document | What you'll find |
|---|---|
| [Architecture Overview](/docs/architecture/overview) | Architecture entry point, shared product flow, ingress model, and runtime boundaries |
| [Request Lifecycle](/docs/architecture/request-lifecycle) | Ownership from ingress validation through admission, routing, selection, transport, and outcome recording |
| [Runtime Generation and Configuration Lifecycle](/docs/architecture/runtime-generation) | Startup validation, staged activation, atomic generations, rollback, and shared-service ownership |
| [Transport and Backend Lifecycle](/docs/architecture/transport-and-backend-lifecycle) | Exact H1/H2 backend behavior, transport ownership, DNS, health, membership, and request feedback |
| [Distributed Quota Contract](/docs/architecture/quota-policy-contract) | Semantic contract for quota semantics, selector composition, and distributed counter behavior |

### Control API and Operations — runtime control, observability, and failure handling

| Document | What you'll find |
|---|---|
| [Observability and Control Configuration](/docs/configuration/observability-and-control) | Focused field reference for metrics, tracing, the Control API, and privilege dropping |
| [Control API Reference](/docs/reference/control-api-reference) | Endpoint-by-endpoint control API contract |
| [Metrics Reference](/docs/reference/metrics-reference) | Metric names, labels, and exported runtime signals |
| [Distributed Quota Operations](/docs/operations/distributed-quota) | Redis deployment, rollout, degraded-mode guidance, and incident interpretation |
| [Operations Runbook](/docs/operations/runbook) | Failure semantics, read-only diagnosis, safe remediation, and escalation criteria |
| [Capacity Planning and Host Tuning](/docs/operations/sizing-and-capacity) | File descriptors, socket buffers, workers, limits, memory pressure, queues, metrics, and testing methodology |

### Protocol, traffic, and policy reference

| Document | What you'll find |
|---|---|
| [Routing and Upstreams](/docs/configuration/routing-and-upstreams) | Exact route precedence, backend selection, key extraction, and weight support |
| [Load Balancing](/docs/user-guide/load-balancing) | Operator guidance for choosing a balancing strategy |
| [Protocol Support](/docs/protocols/support) | Supported ingress and backend protocols, ALPN, limits, early data, CONNECT/WebSocket boundaries, and unsupported features |
| [Security Model](/docs/concepts/security-model) | Current trust boundaries, admin-plane assumptions, and missing security layers |
| [Terminology](/docs/reference/terminology) | Preferred definitions for listener, route, upstream, backend, runtime generation, and lifecycle operations |

### Developer — contribute safely against the current architecture

| Document | What you'll find |
|---|---|
| [Contributing Guide](https://github.com/impulse-proxy/impulse/blob/master/CONTRIBUTING.md) | Dev setup, build commands, test matrix, PR conventions |
| [Contributor Guide](/docs/development/contributing) | Repository boundary, crate map, invariants, test and benchmark policy, and feature checklist |

### Reference — schema, maturity, roadmap, and release state

| Document | What you'll find |
|---|---|
| [Configuration Reference](/docs/configuration/reference) | Configuration schema authority for every configuration block |
| [Status and Limitations](/docs/reference/status-and-limitations) | Product-status authority for maturity, capability support, limitations, and GA blockers |
| [Roadmap](/docs/roadmap) | Possible future direction, separate from the current support contract |
| [Repository Changelog](https://github.com/impulse-proxy/impulse/blob/master/CHANGELOG.md) | Version history, compatibility notes, and behavior changes |
| [GitHub Releases](https://github.com/impulse-proxy/impulse/releases) | Tagged release notes and published artifacts |

---

## Quick reference

If you are in a hurry:

- first run: [getting-started/quickstart.md](/docs/getting-started/quickstart)
- production deployment: [deployment/production.md](/docs/deployment/production)
- incident response: [operations/runbook.md](/docs/operations/runbook)
- troubleshooting: [operations/runbook.md](/docs/operations/runbook)
- product status and limits: [reference/status-and-limitations.md](/docs/reference/status-and-limitations)

For starting examples and exact commands:

- working config snippets: [configuration/examples.md](/docs/configuration/examples)
- full config semantics: [configuration/reference.md](/docs/configuration/reference)
- Control API examples: [reference/control-api-reference.md](/docs/reference/control-api-reference)
- metric names and labels: [reference/metrics-reference.md](/docs/reference/metrics-reference)
- log levels and logging config: [configuration/reference.md](/docs/configuration/reference#logging-configuration)
