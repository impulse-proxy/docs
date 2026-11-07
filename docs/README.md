---
id: index
title: Impulse Documentation
slug: /
sidebar_position: 1
---

Impulse v0.7.0 is a pre-GA reverse proxy for controlled production rollout.
Pingora serves production HTTP/1.1 and HTTP/2 traffic. An independent HTTP/3
ingress is available experimentally. All three protocols share routing, policy,
load balancing, runtime generations, and observability.

| Ingress | Status | Runtime |
| --- | --- | --- |
| HTTP/1.1 and HTTP/2 | Production | Pingora |
| HTTP/3 | Experimental | QUIC/HTTP3 adapter |

Impulse is not yet generally available. Validate the exact protocols,
policies, backends, reloads, and failure modes used by your deployment before
expanding traffic.

## Choose Your Path

| Audience or task | Start here |
| --- | --- |
| Evaluate Impulse and proxy a first request | [Quickstart](/docs/getting-started/quickstart) |
| Configure listeners, routes, backends, and policy | [Configuration Reference](/docs/configuration/reference) |
| Deploy, operate, and troubleshoot | [Production Deployment](/docs/deployment/production) and [Operations Runbook](/docs/operations/runbook) |
| Understand the runtime or contribute changes | [Architecture Overview](/docs/architecture/overview) and [Contributor Guide](/docs/development/contributing) |
| Check support boundaries or product vocabulary | [Feature and Limitation Matrix](/docs/reference/status-and-limitations) and [Terminology](/docs/reference/terminology) |

The [Feature and Limitation Matrix](/docs/reference/status-and-limitations) is the
canonical support boundary for this release.
