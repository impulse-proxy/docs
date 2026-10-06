# Terminology

This page is the authority for reader-facing product terms in the v0.6
documentation. Configuration keys, API fields, metric names, and code
identifiers retain their exact spelling even when they differ from prose terms.

## Quick Lookup

| Need | Term |
| --- | --- |
| configured downstream ingress identity | `listener` |
| primary UDP/QUIC and HTTP/3 ingress | `native QUIC listener` |
| compatibility TCP/TLS ingress for HTTP/1.1 and HTTP/2 | `bootstrap listener` |
| named routing target | `upstream` |
| single origin endpoint inside an upstream | `backend` |
| request match conditions | `route` |
| request policy gate before backend execution | `admission` |
| contract-style request limiting | `quota` |
| runtime self-protection under pressure | `overload` |
| privileged admin HTTP surface | `Control API` |
| operator-facing history of admin actions | `audit` |
| atomically swapped active runtime version | `runtime generation` |
| publishing a candidate runtime generation | `activation` |
| legacy direct-apply operation | `reload` |
| restoring a retained runtime generation | `rollback` |
| stopping new admission while work completes | `drain` |

Use these definitions and preferred phrases consistently across product-reference pages.

| Term | Meaning |
| --- | --- |
| Listener | A configured downstream ingress identity. It owns an address, port, protocol settings, and certificate set and provides the settings from which ingress sockets are created. |
| Native QUIC listener | The primary UDP/QUIC ingress for downstream HTTP/3 traffic. Use this term instead of “QUIC path” when referring to the concrete listener. |
| Bootstrap listener | The automatically paired TCP/TLS compatibility ingress for downstream HTTP/1.1 and HTTP/2. It uses the configured listener identity and is not a separately configured listener. |
| Upstream | A named routing target consisting of route rules, optional TLS policy, load-balancing policy, and one or more backends. |
| Backend | A single origin endpoint inside an upstream. |
| Route | The match conditions that decide which upstream handles a request. |
| Admission | The shared request-policy gate that evaluates route-level rejection, scoped rate limits, quota, brownout, overload, and permit checks before backend execution. |
| Auth | Request-path authentication and authorization decisions, including local auth and external auth integration. |
| Quota | Contract-style request limiting based on explicit selectors and windows. Quota is separate from overload control. |
| Overload | Runtime protection behavior that sheds or delays work to keep the system stable under pressure. |
| Brownout | A specific overload mode in which non-core or lower-priority traffic is shed to preserve core traffic. |
| Control API | The privileged operator-facing admin HTTP surface. |
| Control plane | The broader operator-facing management layer around the Control API, runtime views, watchdog, metrics endpoint, and related admin services. |
| Audit | The operator-facing record of control API actions and runtime-management events. |
| Runtime generation | An immutable version of normalized runtime state. One generation is active, while eligible older generations may be retained for history and rollback. |
| Activation | Preparing and atomically publishing a compatible candidate runtime generation. The staged Control API operation is `POST /admin/runtime/activate`. |
| Reload | The legacy shortcut exposed by `POST /admin/runtime/reload`, which validates and directly applies a compatible candidate without the separate staged workflow. Do not use `reload` as a generic synonym for activation, certificate reload, restart, or drain. |
| Rollback | Restoring an eligible retained runtime generation through `POST /admin/runtime/rollback`. Rollback changes the active generation; it is not a process restart. |
| Metrics endpoint | The Prometheus exposition endpoint. |
| Drain | The process of stopping new admissions while allowing existing work to complete or time out. |
| Certificate reload | Reloading listener certificate material for new handshakes through `POST /admin/runtime/reload-certs`. This is not activation or full config reload. |

## Preferred Usage

Use these phrases consistently unless a page is quoting a metric name, config key, or code identifier.

| Prefer | Avoid when possible | Reason |
| --- | --- | --- |
| `listener` | `proxy listener`, `socket listener` | `listener` is the canonical runtime term. |
| `native QUIC listener` | `QUIC path` when the concrete listener is meant | distinguishes the UDP/HTTP/3 ingress from the shared request path. |
| `bootstrap listener` | `bootstrap TLS listener`, `TCP bootstrap listener` | TLS and TCP are properties of the compatibility listener, not part of its preferred name. |
| `route` | `routing rule` for the main noun | `route` is shorter and already defined. |
| `upstream` | `upstream pool` as the default term | `upstream` is the canonical routing target; mention its backends when needed. |
| `backend` | `origin server` unless external comparison requires it | `backend` matches config, metrics, and runtime views. |
| `admission` | `admission control` everywhere | use `admission` as the general subsystem name; use `admission control` only when the longer phrase materially helps. |
| `auth` | mixed `authentication` / `authorization` wording for shared request-path decisions | `auth` is the shortest shared label for the request-path decision layer. |
| `quota` | `rate limiting` when the feature is specifically quota | quota has different semantics from scoped rate limiting. |
| `overload` | `rate limiting` or `quota` when the meaning is runtime protection | keep contract failure and runtime protection separate. |
| `brownout` | vague phrases like `degraded mode` when the specific overload mode is meant | brownout is a distinct runtime behavior. |
| `Control API` | `admin API` as the primary product term | `Control API` is the canonical product surface. |
| `control plane` | `control-plane services` for the general system every time | use `control plane` for the broader management layer; use `Control API` for the HTTP admin surface. |
| `audit` | `audit log` as the only term | `audit` covers the event stream and operator history more cleanly. |
| `runtime generation` | `generation` alone on first mention | spell out the full phrase on first mention for clarity. |
| `activation` | `reload` for the staged generation workflow | activation is the preferred atomic generation change; reload names the legacy shortcut. |
| `rollback` | `revert` when referring to the Control API operation | rollback names the retained-generation operation. |
| `drain` | `shutdown` when work is still being allowed to finish | drain is a lifecycle phase; shutdown is the final process outcome. |

## Search Aliases

These aliases are common search terms, but they are not the preferred product wording:

| Search term | Canonical term |
| --- | --- |
| admin API | `Control API` |
| origin server | `backend` |
| routing rule | `route` |
| QUIC path, when referring to ingress | `native QUIC listener` |
| bootstrap TLS listener | `bootstrap listener` |
| rate limiting, when the meaning is contract exhaustion | `quota` |
| degraded mode, when the meaning is selective overload shedding | `brownout` |
| config version swap | `runtime generation` |
| config apply | `activation` |
| revert generation | `rollback` |

## Writing Style

Use these style rules across product-reference pages:

- Prefer short, direct sentences.
- Use the canonical term on first mention, then keep using the same term.
- Separate request-path policy concepts from runtime protection concepts.
- Use `Control API` for the admin HTTP surface and `control plane` for the broader operator layer.
- Use `upstream` for the named routing target and `backend` for individual endpoints inside it.
- Use `native QUIC listener` and `bootstrap listener` for the two concrete ingress listeners.
- Use `activation`, `reload`, `rollback`, and `drain` only for the distinct lifecycle operations defined above.
- Avoid mixing code names, config keys, and reader-facing terms in ordinary prose unless needed for precision.
