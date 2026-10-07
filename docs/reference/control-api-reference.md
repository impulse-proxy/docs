# Control API Reference

This page is the authority for Impulse v0.6 Control API endpoints, roles,
request fields, response fields, and HTTP status semantics.

## Open These First

Use this table for common runtime-introspection tasks:

| Need | Endpoint |
|---|---|
| current runtime state, backend health, quota backend state, watchdog state, observability package metadata | `GET /admin/runtime` |
| retained generations, rollback candidates, and recent runtime operations | `GET /admin/runtime/history` |
| one generation's retained record and related entries | `GET /admin/runtime/history/{generation}` |
| check whether a candidate config is valid and compatible | `POST /admin/runtime/validate` |
| dry-run a change and record it in history | `POST /admin/runtime/preview` |
| commit a compatible runtime-managed change | `POST /admin/runtime/activate` |

## Endpoint Index

| Endpoint | Method | Default minimum role | Purpose |
| --- | --- | --- | --- |
| `/health` | `GET` | none (`viewer` when protected) | liveness |
| `/ready` | `GET` | none (`viewer` when protected) | readiness |
| `/admin/runtime` | `GET` | `viewer` | current runtime snapshot |
| `/admin/runtime/history` | `GET` | `viewer` | retained generations and operation history |
| `/admin/runtime/history/{generation}` | `GET` | `viewer` | one retained generation and related entries |
| `/admin/runtime/validate` | `POST` | `operator` | validate a candidate without mutating runtime |
| `/admin/runtime/preview` | `POST` | `operator` | validate and record a preview |
| `/admin/runtime/activate` | `POST` | `operator` | activate a compatible candidate generation |
| `/admin/runtime/rollback` | `POST` | `operator` | restore a retained generation |
| `/admin/runtime/reload` | `POST` | `operator` | legacy full-config reload shortcut |
| `/admin/runtime/reload-certs` | `POST` | `operator` | reload listener certificate material |
| `/admin/runtime/restart` | `POST` | `admin` | request controlled restart through the watchdog |

## Common Control API Flows

Replace angle-bracket placeholders with deployment-specific values.

### Read Current Runtime State

```bash
curl --http1.1 --cacert <path> \
  -H "Authorization: Bearer <token>" \
  https://<control-host>:<port>/admin/runtime
```

### Validate, Preview, and Activate a Candidate

```bash
curl --http1.1 --cacert <path> -X POST \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  https://<control-host>:<port>/admin/runtime/validate \
  -d '{"config_path":"<path>","requested_by":"<actor>","reason":"preflight"}'

curl --http1.1 --cacert <path> -X POST \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  https://<control-host>:<port>/admin/runtime/preview \
  -d '{"config_path":"<path>","requested_by":"<actor>","reason":"preview"}'

curl --http1.1 --cacert <path> -X POST \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  https://<control-host>:<port>/admin/runtime/activate \
  -d '{"config_path":"<path>","expected_generation":<generation>,"requested_by":"<actor>","reason":"deploy"}'
```

### Roll Back to a Retained Generation

```bash
curl --http1.1 --cacert <path> \
  -H "Authorization: Bearer <token>" \
  https://<control-host>:<port>/admin/runtime/history

curl --http1.1 --cacert <path> -X POST \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  https://<control-host>:<port>/admin/runtime/rollback \
  -d '{"target_generation":<target-generation>,"expected_active_generation":<active-generation>,"requested_by":"<actor>","reason":"rollback"}'
```

## Protocol

The Control API uses **HTTP/1.1 over TLS**. HTTP/2 is not supported.

When using curl, pass `--http1.1` explicitly. Curl negotiates HTTP/2 by default
when connecting to a TLS endpoint, and the Control API rejects that connection:

```bash
curl --http1.1 --cacert <path> https://<address>:<port>/...
```

Use a certificate authority (CA) path that verifies the configured Control API certificate. Reserve
`--insecure` for isolated development diagnostics.

## Authentication

The exact TLS, bearer-token, mutual TLS (mTLS) identity, role-based access
control (RBAC), IP-allowlist, audit, and
connection-limit fields are defined in
[Observability and Control Configuration](/docs/configuration/observability-and-control).
This section describes how those settings affect HTTP requests.

Supported authentication shapes:

- bearer token only
- mTLS only
- mTLS + bearer token

Authentication and authorization are separate concerns:

- authentication proves who the caller is
- authorization decides whether the caller has `viewer`, `operator`, or `admin`

Bearer-token form:

```http
Authorization: Bearer <token>
```

Compatibility note:

- `observability.control_api.auth_token` remains supported as the legacy single-token admin credential
- the legacy token retains `admin` privileges
- new deployments should prefer `observability.control_api.auth.bearer_tokens[]` with explicit roles
- compatibility boundary: a new Impulse binary accepts legacy `auth_token` configs, but an older binary rejects configs that use the newer nested control-plane fields

Default role model:

- `viewer`: runtime snapshot and history reads
- `operator`: `viewer` plus validate, preview, activate, rollback, reload, and cert reload
- `admin`: `operator` plus restart

## Route Access Rules

Route families:

- `/health` and `/ready`: unauthenticated unless their protection flag is set
- `/admin/runtime*` reads: `authorization.runtime_read_role` (`viewer` by default)
- runtime mutation routes except restart: `authorization.runtime_mutate_role` (`operator` by default)
- `/admin/runtime/restart`: `authorization.restart_role` (`admin` by default)

Default contract rules:

- `viewer` is the minimum privileged read role
- `operator` is the minimum non-restart mutation role
- `admin` is required for restart
- responses distinguish invalid authentication from insufficient role

## Response Contract

Privileged routes distinguish authentication failure from authorization failure:

- `401 Unauthorized`: missing authentication or invalid authentication
- `403 Forbidden`: authenticated caller is under-scoped, or the source-address policy rejected the request

Representative reasons returned in JSON payloads:

- `missing_authentication`
- `invalid_bearer_token`
- `insufficient_role`
- `source_ip_not_allowed`

When Control API mTLS is `required`, a missing or invalid client certificate
fails during the TLS handshake and does not produce an HTTP `401` or `403`.

## Configuration Boundary

Configuration examples and validation rules intentionally live in
[Observability and Control Configuration](/docs/configuration/observability-and-control).
In particular, that page defines how protected health/readiness routes, custom
role thresholds, mTLS identities, trusted proxy headers, and connection limits
alter the defaults shown here.

## Endpoints

### `GET /health`

Purpose:

- liveness check
- watchdog state visibility

Expected use:

- load balancer or platform liveness probe
- operator sanity check

### `GET /ready`

Purpose:

- readiness state for serving traffic

Expected use:

- deployment orchestration
- maintenance and rollout checks

### `GET /admin/runtime`

Purpose:

- runtime snapshot for operators

Default minimum role:

- `viewer`

Typical contents include:

- worker and runtime state
- key counters
- admission state
- backend health summary
- quota backend health summary
- observability package metadata
- recent admin actions when available
- dashboard and documentation references for the shipped operator bundle

Expected use:

- debugging
- rollout validation
- incident response

The `observability` block is the packaged runtime-introspection entry point for operators. The high-signal fields are:

- `contract_version`
- `audit_schema_version`
- `current_generation`
- `dashboard_packages`
- `documentation`
- `backend_health_summary`
- `quota_backend_health_summary`
- `recent_admin_actions`

Example:

```json
{
  "generation": 12,
  "readiness": "ready",
  "observability": {
    "contract_version": "v1",
    "audit_schema_version": "v1",
    "current_generation": 12,
    "backend_health_summary": {
      "healthy": 7,
      "unhealthy": 1
    },
    "quota_backend_health_summary": {
      "backend_mode": "redis",
      "availability": "available"
    }
  }
}
```

### `POST /admin/runtime/validate`

Purpose:

- parse and validate a candidate config, and report whether it could be activated — without touching the running runtime

Returns `200` with the candidate plan, per-domain diff, and rejected changes.
An incompatible candidate still returns `200`; inspect `rejected_changes` and
`candidate_status`.

Accepts the same optional body fields as `/admin/runtime/reload`.

Expected use:

- CI gating on config changes before a deploy
- confirming a config is loadable before scheduling a maintenance window

Default minimum role:

- `operator`

Example:

```bash
curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/validate \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"config_path":"<path>","requested_by":"<actor>","reason":"preflight"}'
```

### `POST /admin/runtime/preview`

Purpose:

- same planning work as validate, recorded in generation history as an operator preview

Returns `200` with the same plan shape as validate. Neither endpoint mutates the active generation.

Expected use:

- operator dry-run immediately before an activation, when you want the attempt in the audit trail

Default minimum role:

- `operator`

### `POST /admin/runtime/activate`

Purpose:

- stage and commit a config change, returning the structured activation result

Returns `202` on success. Failures are classified rather than collapsed into `500`:

| Status | Meaning |
| --- | --- |
| `400` | the candidate config is invalid |
| `409` | conflict — a stale `expected_generation`, or changes that require a restart |
| `500` | resource preparation failed, or the runtime swap itself failed |

Accepts the same optional body fields as `/admin/runtime/reload`.

Expected use:

- the preferred activation path — prefer this over the legacy `/reload` shortcut, since it returns the full diff, rejection detail, and generation history entry

Default minimum role:

- `operator`

Example:

```bash
curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/activate \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"config_path":"<path>","expected_generation":<generation>,"requested_by":"<actor>","reason":"deploy"}'
```

### `POST /admin/runtime/rollback`

Purpose:

- restore a previously retained runtime generation

Required request body:

| Field | Type | Purpose |
| --- | --- | --- |
| `target_generation` | integer | The retained generation to restore. Required. |
| `expected_active_generation` | integer | Reject with `409` unless this matches the active generation. |
| `requested_by` | string | Recorded in generation history for audit. |
| `reason` | string | Recorded in generation history for audit. |

Returns `202` on success. Failures:

| Status | Meaning |
| --- | --- |
| `404` | the target generation is not retained (unknown generation) |
| `409` | the target is retained but not rollback-eligible, or the active generation moved |
| `500` | resource preparation failed, or the rollback swap itself failed |

Use `GET /admin/runtime/history` first to pick a target whose `rollback_candidate` is `true`.

Default minimum role:

- `operator`

Example:

```bash
curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/rollback \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"target_generation":<generation>}'
```

### `GET /admin/runtime/history`

Purpose:

- list retained runtime generations and the recorded history of control-plane operations

Response shape:

| Field | Type | Purpose |
| --- | --- | --- |
| `active_generation` | integer | The generation serving traffic. |
| `retained_generations` | array | Retained generation records — the state needed to choose a rollback target. |
| `entries` | array | Operation log (validate, preview, activate, rollback), newest first. |

Each entry in `retained_generations`:

| Field | Type | Purpose |
| --- | --- | --- |
| `generation` | integer | The generation number. |
| `status` | string | One of `active`, `previous`, `failed_prepare`, `rolled_back`, `superseded`. |
| `rollback_candidate` | bool | Whether `/admin/runtime/rollback` accepts this generation as a target. |
| `has_bundle` | bool | Whether the runtime bundle is still retained. A rollback target needs `true`. |
| `note` | string | Present only when there is explanatory detail, e.g. why a staged prepare failed. |

`status: failed_prepare` records a candidate generation that was never successfully prepared; it has `has_bundle: false` and carries the failure reason in `note`.

Expected use:

- choosing a safe rollback target
- auditing who changed runtime config, when, and from which config source
- diagnosing why a staged activation never committed
- correlating runtime operations with audit and observability views

Default minimum role:

- `viewer`

Example:

```bash
curl --http1.1 --cacert <path> \
  -H "Authorization: Bearer <token>" \
  https://<control-host>:<port>/admin/runtime/history
```

### `GET /admin/runtime/history/{generation}`

Purpose:

- the retained-generation record and operation entries for a single generation

Returns `200` with `generation`, its `retained_generation`, and related
`entries`. Returns `404` when the generation is not retained.

Default minimum role:

- `viewer`

### `POST /admin/runtime/reload`

Legacy shortcut. Prefer `POST /admin/runtime/activate`, which returns the full diff and rejection detail.

Purpose:

- reload the full config from disk and apply changes to upstreams, backends, policies, timeouts, and `log.level`

Config source:

- with no request body, the reload re-reads the **active runtime config source**
- after startup, the active source is the startup path; activating another
  `config_path` makes that path the source for later reloads
- pass `config_path` in the body to read a different file; a successful activation makes that path the new active source

Important scope note:

- listener bind addresses, control API bind, and metrics bind cannot change without a restart
- log format/file settings, tracing config (`observability.tracing.*`), and
  `performance.control_plane_threads` require a restart; `log.level` applies live
- in-flight requests on the old config complete normally; new requests use the new config immediately

Expected use:

- adding or removing backends
- changing load balancing, timeouts, resilience, or routing policy at runtime

Default minimum role:

- `operator`

Optional request body:

| Field | Type | Purpose |
| --- | --- | --- |
| `config_path` | string | Read this config file instead of the active source. On success it becomes the new active source. |
| `expected_generation` | integer | Reject with `409` unless this matches the active generation (optimistic concurrency). |
| `requested_by` | string | Recorded in generation history for audit. |
| `reason` | string | Recorded in generation history for audit. |

Example:

```bash
curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/reload \
  -H "Authorization: Bearer <token>"
```

Activating an alternate config file:

```bash
curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/reload \
  -H "Authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"config_path":"<path>"}'
```

### `POST /admin/runtime/reload-certs`

Purpose:

- reload listener certificate and related trust material for **new handshakes**

Important scope note:

- this is not full config hot reload
- existing sessions keep their already-negotiated certificate and auth state

Expected use:

- listener certificate rotation
- listener trust-material refresh

Default minimum role:

- `operator`

### `POST /admin/runtime/restart`

Purpose:

- request a controlled restart/drain workflow through the watchdog coordinator

Expected use:

- operational restart requests
- orchestrated maintenance flow

Default minimum role:

- `admin`

## Audit Event Shape

The Control API audit stream is the operator history surface for admin-plane
actions. Audit sink configuration is defined in
[Observability and Control Configuration](/docs/configuration/observability-and-control#audit-output).

Current audit schema version:

- `v1`

The stable top-level event fields are:

- `schema_version`
- `event_id`
- `event_type`
- `time_unix_ms`
- `request_id`
- `trace_id`
- `span_id`
- `listener`
- `actor`
- `action`
- `target`
- `generation`
- `result`
- `reason`
- `failure_class`
- `peer_addr`
- `authn`

Use audit for actor attribution, authn and authz failure history, and attempt-versus-result correlation for runtime operations.

## Related Pages

- [Metrics Reference](/docs/reference/metrics-reference)
- [Control Plane](/docs/operations/control-plane)
- [Operations Runbook](/docs/operations/runbook)
