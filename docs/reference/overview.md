# Reference Overview

This section maps the authoritative references for Impulse v0.6. It is a
navigation page, not an independent behavior contract.

If a guide, example, runbook, or overview conflicts with one of the assigned
references below, the assigned reference wins and the conflicting page should
be corrected.

## Start Here

| Topic | Authoritative page | Use when |
| --- | --- | --- |
| exact feature support | [Feature Matrix](/docs/reference/feature-matrix) | you need to know whether a capability is done, partial, or missing |
| hard product limits | [Limitations](/docs/reference/limitations) | you need boundaries or non-goals |
| exact config semantics | [Configuration Reference](/docs/configuration/reference) | you need field shape, precedence, and runtime meaning |
| exact control-plane interface | [Control API Reference](/docs/reference/control-api-reference) | you need endpoint, role, or response semantics |
| exact metric and label vocabulary | [Metrics Reference](/docs/reference/metrics-reference) | you need exported signal names and labels |
| reader-facing product terms | [Terminology](/docs/reference/terminology) | you need canonical wording |

## Related Navigation

- [API Overview](/docs/api/overview) is the short entry point for metrics and the Control API.
- [Operations Overview](/docs/operations/overview) is the main deployment, rollout, and recovery entry point.
- [Authentication and Secrets](/docs/configuration/authentication-and-secrets) provides the focused downstream-auth and secret-provider schema governed by the Configuration Reference.
- [TLS Setup](/docs/configuration/tls) provides task-oriented certificate and trust guidance governed by the Configuration Reference.
- [Operations Runbook](/docs/operations/runbook) is the symptom-driven diagnosis and recovery guide.
