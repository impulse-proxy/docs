# Routing and Upstreams

This page expands the routing, upstream, backend, and load-balancing sections
of the [Configuration Reference](/docs/configuration/reference). The main
configuration reference remains authoritative for the schema; this page keeps
the traffic-selection rules together in one place.

## Upstream schema

The top-level `upstream` value is a non-empty map. Each key is an upstream pool
name used by routing, metrics, runtime views, and policies such as brownout
`core_routes`.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `route` | object | Yes | — | Request matcher for this upstream. |
| `backends` | array of objects | Yes | — | Non-empty backend pool. |
| `load_balancing` | object | No | `{ type: round-robin, key: null }` | Backend-selection policy for this upstream. |
| `auth` | object | No | `{}` | API-key, JWT, external-auth, scope, and role policy for this route. See [Authentication and Secrets](/docs/configuration/authentication-and-secrets). |
| `host_policy` | object | No | `{ mode: pass_through, host: null }` | Upstream `Host`/`:authority` selection. |
| `forwarded_headers` | object | No | `{ mode: overwrite }` | `Forwarded` and `X-Forwarded-*` handling. |
| `tls` | object or `null` | No | `null` | Complete per-upstream TLS override. `null` inherits `upstream_tls`. |

Upstream names must be non-empty. The top-level `load_balancing` field is not
a fallback in v0.6; each upstream either configures its own policy or uses
`round-robin`.

## Route matching

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `host` | string or `null` | Conditionally | `null` | Exact host or a single leading-wildcard suffix such as `*.example.com`. At least `host` or `path_prefix` is required. |
| `path_prefix` | string or `null` | Conditionally | `null` | Non-empty path beginning with `/`. At least `host` or `path_prefix` is required. |
| `method` | string or `null` | No | `null` | Optional HTTP method restriction. |

All configured fields must match the request. A method alone does not make a
valid route.

### Host behavior

- Matching is case-insensitive.
- Configuration and request hosts are trimmed and normalized to lowercase.
- A numeric port and one or more trailing dots are removed before matching.
- An exact host matches only that host.
- A leading wildcard matches one or more subdomain labels. For example,
  `*.example.com` matches `api.example.com` and `a.b.example.com`, but not
  `example.com`.
- Only one leading `*.` wildcard is accepted. Embedded wildcards, whitespace,
  paths, queries, and fragments are rejected.

### Path behavior

- Routing uses the URI path and ignores the query component.
- Prefixes match on segment boundaries. `/api` matches `/api` and
  `/api/users`, but not `/apix`.
- `/` is the catch-all path prefix.
- Percent-encoded unreserved bytes are canonicalized before matching, so
  `/%61pi` is routed as `/api`. Ambiguous encodings and path forms are rejected
  by request validation.

### Method behavior

The configured method is trimmed and normalized to uppercase. Request matching
is therefore case-insensitive. An omitted, `null`, empty, or whitespace-only
value means any method. Use valid HTTP method tokens such as `GET`, `POST`, or
`DELETE`.

### Selection precedence

Declaration order does not choose a route. When more than one route matches,
Impulse applies these tie-breakers in order:

1. Longer `path_prefix`.
2. Host-specific route over a host-agnostic route.
3. Exact host over a wildcard host.
4. Longer wildcard suffix, so `*.a.example.com` beats `*.example.com`.
5. Method-specific route over a method-agnostic route.
6. Lexicographically smaller upstream name.

Duplicate normalized `(host, path_prefix, method)` matchers are rejected.

## Load-balancing schema

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `type` | string | No | `round-robin` | Strategy name or accepted alias. Values are matched case-insensitively; surrounding whitespace is not accepted. |
| `key` | string or `null` | No | `null` | Request-key source used by `consistent-hash`, or by `sticky-cid` as an explicit override. |

### Strategies and aliases

| Strategy | Accepted values | Selection behavior |
| -------- | --------------- | ------------------ |
| Round robin | `round-robin`, `round_robin`, `rr` | Walks a deterministic weighted schedule of healthy backends. |
| Random | `random` | Samples healthy backends in proportion to weight. |
| Consistent hash | `consistent-hash`, `consistent_hash`, `ch` | Maps a request key onto a weighted hash ring; the same key remains stable while healthy membership is unchanged. |
| Least connections | `least-connections`, `least_connections`, `lc` | Chooses the healthy backend with the fewest active requests; backend index breaks ties. |
| Latency aware | `latency-aware`, `latency_aware`, `la` | Scores measured latency plus active-request pressure, with bounded probing and exploration for unsampled backends. |
| Sticky CID | `sticky-cid`, `sticky_cid`, `cid-sticky`, `cid_sticky` | Uses the consistent-hash ring with the QUIC connection ID by default. |

Unknown strategy names are rejected. Every strategy excludes unhealthy
backends. If no healthy backend remains, selection fails instead of sending to
an unhealthy backend.

## Request-key sources

Request-key specifications are trimmed and normalized to lowercase. A
`header`, `cookie`, or `query` source must include a non-empty name after the
colon.

| Accepted value | Meaning |
| -------------- | ------- |
| `header:<name>` | Value of the named request header. Header names are case-insensitive. |
| `cookie:<name>` | Value of the named cookie from the `Cookie` header. Cookie-name comparison is case-insensitive. |
| `query:<name>` | Value of the named query parameter. Parameter-name comparison is case-insensitive. |
| `path` | Request path without the query string. |
| `authority` | Request authority. |
| `method` | Uppercase HTTP method. |
| `cid`, `sticky-cid` | Aliases for the current QUIC connection ID. |
| `peer_ip`, `client_ip` | Aliases for the connected client IP when that value is available to the selector. |
| `bearer_token` | Token from a case-insensitive `Bearer` scheme in the `Authorization` header. |

In the v0.6 backend-selection path, the client socket address is not supplied
to the request-key resolver. Consequently, `peer_ip` and `client_ip` are
accepted configuration values but fall through to the default key during
backend selection. They remain usable by policy selectors that supply a client
address.

An unsupported key specification is rejected during configuration validation.
If extraction from a valid specification produces a missing, empty, invalid,
or unavailable value, selection uses the default key: request authority when
present, otherwise the request target, otherwise the method. For `sticky-cid`,
an available connection ID is tried before that default. An explicit `key`
overrides the normal `sticky-cid` CID choice when extraction succeeds.

Strategies other than `consistent-hash` and `sticky-cid` accept a valid `key`
value but do not use it to choose a backend.

## Backend weights

Every backend weight must be in the inclusive range `1`–`1000`; the default is
`100`.

| Strategy | Weight support | Effect |
| -------- | -------------- | ------ |
| `round-robin` | Supported | Controls frequency in the deterministic schedule. |
| `random` | Supported | Controls relative selection probability. |
| `consistent-hash` | Supported | Controls virtual-node count on the hash ring. |
| `sticky-cid` | Supported | Controls virtual-node count on its consistent-hash ring. |
| `least-connections` | Rejected unless `100` | The strategy is intentionally unweighted. |
| `latency-aware` | Rejected unless `100` | The strategy is intentionally unweighted. |

## Backends

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `id` | string | Yes | — | Non-empty label used in logs, metrics, and runtime views. |
| `address` | string | Yes | — | Backend origin: `host`, `host:port`, `https://host[:port]`, `http://host[:port]`, or bracketed IPv6 with an explicit port. |
| `weight` | integer | No | `100` | Relative weight in the range `1`–`1000`, subject to the strategy matrix above. |
| `health_check` | object or `null` | No | `null` | Active health-check policy. `null` disables active polling. |

Only `http` and `https` schemes are accepted. Addresses cannot contain a path,
query, or fragment. A missing scheme means HTTPS. HTTPS defaults to port `443`
and selects HTTP/2 transport; HTTP defaults to port `80` and selects HTTP/1.1.
Both protocols can appear in one upstream. Duplicate normalized origins are
rejected across the entire configuration.

### Health checks

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `path` | string | No | `/health` | Request path. A blank value is normalized to `/`. |
| `interval` | integer | No | `5000` | Poll interval in milliseconds; must be greater than `0`. |
| `timeout_ms` | integer | No | `1000` | Per-check timeout in milliseconds; must be greater than `0`. |
| `failure_threshold` | integer | No | `3` | Consecutive failures required to mark the backend unhealthy; must be greater than `0`. |
| `success_threshold` | integer | No | `2` | Consecutive successes required to mark the backend healthy; must be greater than `0`. |
| `cooldown_ms` | integer | No | `5000` | Unhealthy cooldown in milliseconds; must be greater than `0`. |

Omitting `health_check` disables active polling. Passive health and other
runtime eligibility signals can still remove a backend from selection.

Backend DNS refresh is global, under `performance`:

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `backend_dns_refresh_enabled` | boolean | No | `false` | Enables periodic refresh for hostname backends. |
| `backend_dns_refresh_interval_ms` | integer | No | `30000` | Refresh interval in milliseconds; must be greater than `0` even when refresh is disabled. |

## Upstream request headers and TLS

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `host_policy.mode` | string | No | `pass_through` | Host selection mode. |
| `host_policy.host` | string or `null` | Conditionally | `null` | Required for `rewrite`; rejected for other modes. |
| `forwarded_headers.mode` | string | No | `overwrite` | Forwarded-header handling mode. |

`host_policy.mode` accepts these canonical values:

| Mode | Behavior |
| ---- | -------- |
| `pass_through` | Uses client `:authority`, then client `Host`, then backend authority. The alias `pass-through` is also accepted. |
| `rewrite` | Uses the required static `host_policy.host` value. |
| `upstream` | Uses the backend authority, including its port. |

`host_policy.host` is required for `rewrite` and rejected for other modes.

`forwarded_headers.mode` controls `Forwarded`, `X-Forwarded-For`,
`X-Forwarded-Proto`, and `X-Forwarded-Host`:

| Mode | Behavior |
| ---- | -------- |
| `overwrite` | Discards inbound values and writes the current hop. |
| `append` | Retains the inbound chain and appends the current hop. |
| `preserve` | Retains inbound values without adding the current hop. |

When `upstream.<name>.tls` is present, it replaces rather than merges with the
top-level `upstream_tls` policy.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `verify_certificates` | boolean | No | `true` | Verifies the backend certificate and identity. |
| `strict_sni` | boolean | No | `true` | Sends the backend hostname in the TLS SNI extension. |
| `ca_file` | string or `null` | No | `null` | PEM CA bundle path. |
| `ca_dir` | string or `null` | No | `null` | Directory containing PEM CA material. |
| `client_certificate` | string or `null` | Conditionally | `null` | Client-certificate PEM file path; must be paired with a client key. |
| `client_certificate_ref` | object or `null` | Conditionally | `null` | Secret reference (`{ ref: "..." }`) for the client certificate; mutually exclusive with `client_certificate`. |
| `client_key` | string or `null` | Conditionally | `null` | Client private-key PEM file path; must be paired with a client certificate. |
| `client_key_ref` | object or `null` | Conditionally | `null` | Secret reference (`{ ref: "..." }`) for the client key; mutually exclusive with `client_key`. |

Client certificate and key settings require at least one HTTPS backend.
Setting `strict_sni: false` disables SNI only; it does not disable certificate
verification. See [TLS Configuration](/docs/configuration/tls#upstream-backend-tls)
for CA composition, client mTLS, and activation behavior.

## Canonical example

This is the only complete backend-pool example on this page. It demonstrates
combined host, path, and method routing; an explicit request key; weighted
consistent hashing; and active health checks.

```yaml
upstream:
  tenant_api:
    route:
      host: "api.example.com"
      path_prefix: "/v1"
      method: GET
    load_balancing:
      type: consistent-hash
      key: "header:x-tenant-id"
    host_policy:
      mode: upstream
    forwarded_headers:
      mode: overwrite
    backends:
      - id: "api-a"
        address: "https://api-a.internal:8443"
        weight: 100
        health_check:
          path: "/ready"
          interval: 5000
          timeout_ms: 1000
          failure_threshold: 3
          success_threshold: 2
          cooldown_ms: 5000
      - id: "api-b"
        address: "https://api-b.internal:8443"
        weight: 200
        health_check:
          path: "/ready"
          interval: 5000
          timeout_ms: 1000
          failure_threshold: 3
          success_threshold: 2
          cooldown_ms: 5000
```
