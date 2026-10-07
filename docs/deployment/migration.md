# Migrating to Impulse from NGINX or Envoy

This guide helps platform and site reliability engineering (SRE) teams migrate
from NGINX or Envoy. It covers an additive HTTP/3 ingress pattern and an
incremental replacement pattern.

## Before You Start

Impulse terminates HTTP/3 and sends requests to HTTP/2 (`https://`) or
HTTP/1.1 (`http://`) backends. It supports named upstream pools, host and path
routing, health checks, scoped rate limits, and request authentication. Review
[Status and Limitations](/docs/reference/status-and-limitations) before
migrating workloads that depend on transformation filters, a service-mesh
control plane, or a web application firewall (WAF).

Choose one migration pattern:

- Pattern A places Impulse in front of the existing proxy and leaves its
  routing and backend configuration in place.
- Pattern B moves routes to Impulse incrementally and retains the existing
  proxy as a fallback until the migration finishes.

Before either pattern:

- provide a health endpoint for every backend
- record baseline 5xx error rate and p99 latency
- rehearse rollback in a non-production environment
- retain the existing proxy binary, configuration, and certificates

## Pattern A: Impulse as HTTP/3 Ingress in Front of Your Existing Proxy

The existing proxy remains active and owns its current routing. Impulse accepts
HTTP/3 on the native QUIC listener and HTTP/1.1 or HTTP/2 on the bootstrap
listener, then forwards every request to the existing proxy.

### 1. Leave the Existing Proxy Running

Do not change its configuration or listener ports.

### 2. Configure Impulse

One Impulse listener uses the same address and port for UDP/QUIC and TCP
bootstrap traffic. The following example sends every route to an existing
proxy on `127.0.0.1:443`:

```yaml
# Pattern A: Impulse in front of NGINX or Envoy
listen:
  protocol: http3
  address: "0.0.0.0"
  port: 9889
  tls:
    cert: /etc/impulse/tls/fullchain.pem
    key: /etc/impulse/tls/privkey.pem

upstream:
  existing-proxy:
    load_balancing:
      type: round-robin
    route:
      host: "*.example.com"
      path_prefix: "/"
    backends:
      - id: existing-proxy-1
        address: "https://127.0.0.1:443"
        health_check:
          path: /healthz
          interval: 10000
          timeout_ms: 3000
          failure_threshold: 3
          success_threshold: 2
```

Impulse must present a certificate that clients trust. Configure upstream trust
when the existing proxy uses a private certificate authority, or use an
explicit `http://` loopback backend when cleartext loopback traffic is
acceptable for the deployment.

### 3. Shift Traffic

Point the Domain Name System (DNS) records or load-balancer target at Impulse.
Use a canary and set the DNS time to live (TTL) before the migration window so
rollback does not depend on a long cached value.

### 4. Verify Traffic

Confirm both listener transports, backend health, error rate, and latency. The
existing proxy remains the only backend in this pattern.

## Pattern B: Replacing Your Existing Proxy Route by Route

Pattern B moves one route at a time and keeps the existing proxy as the
catch-all backend until no fallback traffic remains.

### 1. Select a Route

Start with a low-risk, observable route such as a static asset or read-only
endpoint. Avoid authentication, payment, and other critical routes for the
first migration.

### 2. Configure the Route and Fallback

Define one upstream for the selected route and a catch-all upstream for the
existing proxy. Unmatched traffic continues through the fallback.

### 3. Shift Only the Selected Traffic

Use one of these controls:
- Add a load-balancer rule for the selected path and leave other rules on the existing proxy.
- If you use weighted DNS per subdomain (e.g., `static.example.com`), cut the subdomain over to Impulse.
- When both proxies share a host, bind Impulse to a separate port during the canary and shift only the selected rule.

### 4. Validate the Route

Choose an observation window appropriate to the route and compare:
- 5xx error rate for the migrated route against your pre-migration baseline from the old proxy
- p99 latency for the migrated route
- health transitions in Impulse logs

If error rate is elevated, latency has regressed, or health checks are unstable, roll back to the old proxy for that route and investigate before continuing.

### 5. Repeat by Route

Repeat the workflow after the route meets its acceptance criteria. Increase
criticality gradually.

### 6. Remove the Fallback

Remove the fallback only after it receives no traffic and the defined rollback
window has passed. Retain the old binary and configuration according to the
deployment rollback policy.

### Pattern B Config Sketch

Every request needs a destination. Model the existing proxy as the catch-all
upstream for remaining routes.

```yaml
# Pattern B: incremental route migration
listen:
  protocol: http3
  address: "0.0.0.0"
  port: 9889
  tls:
    cert: /etc/impulse/tls/fullchain.pem
    key: /etc/impulse/tls/privkey.pem

upstream:
  static-origin:
    load_balancing:
      type: round-robin
    route:
      path_prefix: "/static"
    backends:
      - id: static-origin-1
        address: "http://192.0.2.20:8080"
        health_check:
          path: /healthz
          interval: 10000
          timeout_ms: 3000
          failure_threshold: 3
          success_threshold: 2

  legacy-proxy:
    load_balancing:
      type: round-robin
    route:
      path_prefix: "/"
    backends:
      - id: legacy-proxy-1
        address: "https://127.0.0.1:443"
        health_check:
          path: /healthz
          interval: 15000
          timeout_ms: 5000
          failure_threshold: 2
          success_threshold: 1
```

Add one upstream with a more-specific `route.path_prefix` for each migrated
route. Longest-prefix matching selects it before the `/` fallback. Remove the
fallback only after it receives no traffic.

## NGINX to Impulse Config Translation

| NGINX directive | Impulse equivalent |
|---|---|
| `upstream mypool { server 192.0.2.20:8080; }` | A `mypool:` key under the `upstream:` map with a `backends:` list containing `id:` and `address: "http://192.0.2.20:8080"` |
| `proxy_pass http://mypool` | The `mypool:` pool's own `route:` block (`host`/`path_prefix`); there is no separate name reference — the match lives on the pool |
| `location /api { ... }` | `route: { path_prefix: "/api" }` inside the relevant upstream pool |
| `proxy_next_upstream error timeout http_502` | Per-backend `health_check:` config with `failure_threshold` controlling how many consecutive failures remove a backend from rotation; retries on connection error are automatic |
| `least_conn` | `load_balancing: { type: least-connections }` inside the upstream pool |
| `ip_hash` | `load_balancing: { type: consistent-hash }` (hashes on client address by default) |
| `keepalive 32` | Impulse maintains a connection pool to upstream backends automatically; the pool size is not separately configurable |
| `ssl_certificate /path/cert.pem` | `listen.tls.cert: /path/cert.pem` under the relevant listener |
| `ssl_certificate_key /path/key.pem` | `listen.tls.key: /path/key.pem` under the relevant listener |

## Features That Do Not Translate Directly

These are current product boundaries, not roadmap statements:

- **Dynamic modules and compression filters:** Impulse has no module system or
  body-processing pipeline. Keep a WAF or compression layer elsewhere when a
  route depends on it.
- **Envoy xDS:** Impulse uses file-backed runtime generations, not a push-based
  sidecar control plane. Use `validate`, `preview`, `activate`, and `rollback`
  for staged changes. Keep Envoy where Aggregated Discovery Service (ADS) or
  Endpoint Discovery Service (EDS) remains required.
- **Lua and WebAssembly filters:** Move per-request scripting to the
  application or another middleware layer.
- **URL rewriting:** Impulse forwards the upstream path unchanged. Normalize
  paths at the origin or retain a rewriting proxy for those routes.
- **Response-header manipulation:** Set required response headers at the
  origin or another middleware layer.
- **Expression-based per-IP limits:** Impulse provides scoped rate limits and
  distributed quota, but not the full NGINX or Envoy expression surface. Keep
  the existing limiting layer when a route depends on those expressions.

## Rollback Procedure

Use this procedure when the existing proxy remains the rollback target.

### 1. Confirm the Rollback Artifacts

Verify that the old proxy binary, configuration, and TLS material remain
available before shifting traffic.

### 2. Stop Impulse

```bash
sudo systemctl stop impulse
```

This stops new connections. Existing connections close according to the
configured drain and transport behavior.

### 3. Start the Existing Proxy

```bash
# For NGINX:
sudo systemctl start nginx

# For Envoy:
sudo systemctl start envoy
```

Confirm the old proxy is listening and healthy before updating DNS:

```bash
curl --resolve <host>:443:127.0.0.1 --cacert <path> https://<host>/healthz
```

### 4. Restore Traffic Routing

Restore the DNS records or load-balancer target. If the rollout uses weighted
traffic, return the old proxy to the intended rollback weight.

### 5. Verify Recovery

Confirm requests in the old proxy logs, then compare error rate and latency
with the pre-migration baseline. Investigate the failed migration outside
production before retrying it.

## Related Pages

- [Status and Limitations](/docs/reference/status-and-limitations)
- [Production Deployment](/docs/deployment/production)
- [Routing and Upstreams](/docs/configuration/routing-and-upstreams)
- [Operations Runbook](/docs/operations/runbook)
