# Terminology

Use these reader-facing terms throughout the v0.7 documentation. Configuration
keys, API fields, metric labels, and code identifiers keep their exact spelling
even when they use legacy vocabulary.

| Term | Meaning |
| --- | --- |
| Listener | A configured downstream address, port, and TLS identity from which ingress sockets are created. |
| Pingora ingress | The production TLS/TCP ingress for downstream HTTP/1.1 and HTTP/2. |
| HTTP/3 ingress | The experimental QUIC/UDP ingress for downstream HTTP/3. |
| Route | Host, path-prefix, and method conditions that select an upstream. |
| Upstream | A named routing target containing policy, load-balancing settings, and one or more backends. |
| Backend | One origin endpoint inside an upstream. |
| Auth | Request authentication and authorization, including local and external decisions. |
| Admission | Policy and capacity gates applied before backend execution. |
| Scoped rate limit | A process-local request contract enforced with token buckets. |
| Quota | A request contract based on explicit identity selectors and time windows; separate from overload protection. |
| Overload | Runtime protection that rejects or delays work to preserve stability. |
| Brownout | Overload behavior that sheds non-core traffic to preserve core traffic. |
| Compiled plugin | A plugin kind included in the binary by a Cargo feature. |
| Active plugin | A compiled plugin used by the active runtime generation. |
| Runtime generation | One immutable, normalized runtime state published atomically. |
| Activation | Preparing and publishing a compatible candidate runtime generation. |
| Reload | The legacy direct-apply Control API operation; not a synonym for activation, restart, or certificate reload. |
| Rollback | Publishing an eligible generation retained in runtime history. |
| Drain | Stopping new admission while bounded in-flight work completes. |
| Certificate reload | Replacing downstream listener TLS material for new handshakes through `reload-certs`. |
| Control API | The privileged operator HTTP surface. |
| Control plane | The Control API, runtime views, watchdog, metrics service, and audit services together. |

## Usage Rules

- Use **Pingora ingress** and **HTTP/3 ingress**, not bootstrap, compatibility,
  QUIC path, or listener implementation names in reader-facing prose.
- Use **upstream** for the named routing target and **backend** for one endpoint.
- Use **auth**, **scoped rate limit**, **quota**, and **overload** only for their
  distinct decisions; a `429` contract rejection is not overload shedding.
- Use **activation**, **rollback**, **reload**, **certificate reload**, and
  **drain** only for the lifecycle operations defined above.
- Spell out **runtime generation** on first mention; use **generation** after it.
- Use **Control API** for the HTTP service and **control plane** for the broader
  operator subsystem.
- Preserve exact names such as `connection_rate_limit_enabled`,
  `POST /admin/runtime/activate`, and metric label value `bootstrap` when
  documenting machine contracts.

## Canonical Pages

| Concept | Authority |
| --- | --- |
| Product support boundary | [Feature and Limitation Matrix](/docs/reference/status-and-limitations) |
| Runtime components and ownership | [Architecture Overview](/docs/architecture/overview) |
| Request phase ordering | [Request Lifecycle](/docs/architecture/request-lifecycle) |
| Generation lifecycle | [Runtime Generation](/docs/architecture/runtime-generation) |
| Configuration examples and topic owners | [Configuration Reference](/docs/configuration/reference) |
| Runtime operations | [Production Deployment](/docs/deployment/production) |
| Endpoint and metric contracts | [Control API Reference](/docs/reference/control-api-reference) and [Metrics Reference](/docs/reference/metrics-reference) |
