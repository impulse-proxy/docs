# Authentication and Secrets

This page is the Impulse v0.6 reference for downstream request authentication
and secret-provider configuration. The general
[Configuration Reference](/docs/configuration/reference) remains the schema
authority. For trust boundaries and deployment posture, see the
[Security Model](/docs/concepts/security-model).

## Two Separate Authentication Planes

Do not confuse request authentication with Control API authentication:

| Plane | Configuration | Protects |
| --- | --- | --- |
| Downstream request path | `upstream.<name>.auth` | Requests routed to that upstream |
| Control API | `observability.control_api.auth_token`, `auth_token_ref`, `auth`, `tls.client_auth`, and `ip_allowlist` | Operator endpoints such as validate, activate, rollback, reload, and restart |

This page documents the first plane. Secret references are shared configuration
machinery and can also supply Control API bearer tokens, but that does not make
the two authentication policies interchangeable. See the
[Control API Reference](/docs/reference/control-api-reference) for admin-plane
authentication and authorization.

## Downstream Authentication Policy

Each named upstream accepts an optional `auth` object:

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `api_key` | object or `null` | No | `null` | Validates a key in one request header. |
| `jwt` | object or `null` | No | `null` | Validates a bearer JSON Web Token (JWT) locally. |
| `external_auth` | object or `null` | No | `null` | Delegates the decision to an HTTP or OpenID Connect (OIDC) introspection service. |
| `required_scopes` | array of strings | No | `[]` | JWT scopes that must all be present. Requires `jwt`. |
| `required_roles` | array of strings | No | `[]` | JWT roles that must all be present. Requires `jwt`. |

When both `api_key` and `jwt` are configured, a request must pass both checks.
`external_auth` cannot be combined with either local mechanism, or with
`required_scopes` or `required_roles`, in v0.6. Authentication runs before the
request is dispatched to a backend.

## Application Programming Interface (API) Keys

```yaml
upstream:
  private_api:
    route:
      host: "api.example.com"
      path_prefix: "/private"
    auth:
      api_key:
        header_name: "x-api-key"
        keys:
          - "<api-key>"
    backends:
      - id: "private-1"
        address: "https://private.internal.example:8443"
```

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `header_name` | string | No | `x-api-key` | Header containing the presented key. Must be a non-empty valid HTTP header name. |
| `keys` | array of strings | Yes | `[]` | Accepted keys. Must contain at least one non-empty value and no duplicates after trimming. |

The presented header value is trimmed, then compared exactly and in constant
time against the configured values. A missing, empty, or non-matching value is
rejected with `401 Unauthorized`. Values are case-sensitive. API-key values
are omitted from serialized configuration views and redacted from debug output,
but plaintext values still exist in the source configuration and process
memory.

API keys do not accept secret-reference objects. Protect the
configuration file accordingly.

## JSON Web Tokens (JWTs)

Impulse reads a bearer token from `Authorization`, checks the token algorithm
against explicit policy, verifies its signature locally, then validates claims.
A remote JSON Web Key Set (JWKS) is refreshed outside the request path;
request validation only reads the in-memory key cache.

### JWT Fields

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `secret` | string | Conditionally | `""` | Inline `HS256` shared secret. Mutually exclusive with `secret_ref`. |
| `secret_ref` | object or `null` | Conditionally | `null` | `HS256` secret reference, for example `{ ref: "file://jwt.key" }`. |
| `issuer` | string or `null` | No | `null` | One exact accepted `iss` value. Mutually exclusive with `issuers`. |
| `issuers` | array of strings or `null` | No | `null` | Non-empty list of exact accepted `iss` values. |
| `audience` | string or `null` | No | `null` | One accepted `aud` value. Mutually exclusive with `audiences`. |
| `audiences` | array of strings or `null` | No | `null` | Non-empty list of accepted `aud` values. |
| `allowed_algorithms` | array | No | `[HS256]` | Non-empty allowlist. Accepted values are `HS256`, `RS256`, and `ES256`; lowercase aliases are also accepted in configuration. |
| `require_kid` | boolean | No | `false` | Rejects tokens without a JOSE `kid` header. |
| `static_keys` | array | No | `[]` | Static PEM or JWK public verification keys for `RS256`/`ES256`. |
| `jwks_url` | string or `null` | No | `null` | Absolute HTTPS URL for a remote JWKS document. |
| `jwks_refresh_interval_secs` | integer | No | `300` | Periodic refresh interval. Must be greater than zero when `jwks_url` is set. |
| `jwks_request_timeout_ms` | integer | No | `2000` | JWKS request timeout. Must be greater than zero when `jwks_url` is set. |
| `jwks_cache_ttl_secs` | integer | No | `900` | Time after a successful fetch before cached keys become stale. Must be greater than zero when `jwks_url` is set. |
| `jwks_stale_if_error_secs` | integer | No | `3600` | Additional interval during which retained keys may be used after staleness or refresh failure. `0` disables the additional interval. |
| `jwks_startup_behavior` | string | No | `require_ready` | `require_ready` rejects startup or a candidate runtime generation when the source cannot provide usable keys; `allow_degraded` starts without them and rejects affected requests until keys become available. |
| `clock_skew_secs` | integer | No | `30` | Leeway applied to `exp`, `nbf`, and future `iat` checks. |

At least one usable key source is required. Enabling `HS256` requires `secret`
or `secret_ref`, and configuring either secret requires `HS256` in
`allowed_algorithms`. `static_keys` and `jwks_url` require `RS256` or `ES256`
in the allowlist. `alg: none` and algorithms outside the three listed above
are rejected.

### Symmetric-Key Example

```yaml
secrets:
  default_provider: auth_files
  providers:
    auth_files:
      kind: file
      base_dir: "/run/impulse/secrets"

upstream:
  api:
    route:
      path_prefix: "/api"
    auth:
      jwt:
        secret_ref:
          ref: "file://jwt-hs256.key"
        issuer: "https://issuer.example.com"
        audience: "impulse-api"
        allowed_algorithms: [HS256]
        clock_skew_secs: 30
      required_scopes: ["api:read"]
      required_roles: ["customer"]
    backends:
      - id: "api-1"
        address: "https://api.internal.example:8443"
```

### Static Public-Key Example

Asymmetric entries are verification keys, not private signing keys. Keep
private signing keys at the issuer.

```yaml
auth:
  jwt:
    allowed_algorithms: [RS256, ES256]
    require_kid: true
    static_keys:
      - kind: pem
        kid: "rsa-2026-01"
        alg: RS256
        public_key_pem: |
          -----BEGIN PUBLIC KEY-----
          ...
          -----END PUBLIC KEY-----
      - kind: jwk
        kid: "ec-2026-01"
        alg: ES256
        jwk: '{"kty":"EC","crv":"P-256","x":"...","y":"..."}'
```

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `kind` | string | Yes | — | `pem` or `jwk`. |
| `kid` | string or `null` | No | `null` | Key identifier. If present, it must be non-empty. |
| `alg` | string or `null` | No | `null` | Restricts this key to `RS256` or `ES256`. |
| `public_key_pem` | string | For `pem` | — | Non-empty public-key PEM. |
| `jwk` | string | For `jwk` | — | A non-empty JSON-encoded JWK string. |

RSA verification keys must be at least 2048 bits. ES256 keys must use P-256.
For a token with `kid`, the identifier and algorithm must select exactly one
compatible key. Without `kid`, exactly one algorithm-compatible key must
remain; ambiguity is rejected. `require_kid: true` rejects a missing `kid`
before key selection. Conflicting static entries with the same configured
`kid` are rejected.

### JWKS Example and Lifecycle

```yaml
auth:
  jwt:
    allowed_algorithms: [RS256]
    require_kid: true
    issuers:
      - "https://issuer.example.com"
    audiences:
      - "impulse-api"
    jwks_url: "https://issuer.example.com/.well-known/jwks.json"
    jwks_refresh_interval_secs: 300
    jwks_request_timeout_ms: 2000
    jwks_cache_ttl_secs: 900
    jwks_stale_if_error_secs: 3600
    jwks_startup_behavior: require_ready
```

- `require_ready` preflights the JWKS source during process startup and runtime
  candidate preparation. Failure leaves the existing runtime generation
  unchanged.
- `allow_degraded` permits activation without a usable JWKS set. Tokens that
  need unavailable keys are rejected; they are never admitted by fallback.
- Successful refreshes replace the active set while retaining non-conflicting
  rollover keys for the configured stale interval. Failed or unusable
  refreshes keep last-known-good keys only until their TTL plus stale window
  expires.
- An unknown `kid` can hint an asynchronous refresh, subject to a cooldown.
  Impulse does not fetch JWKS synchronously to complete that request.

### Claims, Scopes, and Roles

Every JWT must have a numeric `exp` claim. Numeric `nbf` and `iat` claims are
checked when present. Clock skew extends expiration tolerance and tolerates a
limited future `nbf` or `iat` value.

When issuer policy is configured, `iss` must exactly match one accepted value.
When audience policy is configured, `aud` may be a string or an array and at
least one value must match. With no issuer or audience policy, those claims are
not required.

All `required_scopes` and all `required_roles` must be present. Scope values are
collected from `scope` and `scp`; role values are collected from `roles` and
`role`. Each claim may be a whitespace-separated string or an array of
strings. Matching is exact and case-sensitive. Empty required values are
invalid.

Impulse v0.6 has no arbitrary `required_claims` map. The required registered
claim is `exp`; additional enforcement is limited to issuer, audience, scopes,
and roles.

Missing or invalid local credentials, signatures, keys, or claims produce
`401 Unauthorized`.

## External Authorization

External authorization is asynchronous and runs before backend dispatch. One
provider may be configured per upstream. The provider uses a dedicated HTTP
client and is not a member of the upstream backend pool.

### Generic HTTP Authorization

```yaml
auth:
  external_auth:
    kind: http
    endpoint: "https://auth.internal.example/check"
    request_headers:
      - name: "x-auth-service-key"
        value: "<token>"
    response_header_allowlist:
      - "x-authenticated-user"
    timeout_ms: 1000
    failure_mode: fail_closed
```

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `kind` | string | Yes | — | `http`. |
| `endpoint` | string | Yes | — | Absolute HTTPS URL; loopback HTTP is also accepted. |
| `request_headers` | array of `{name, value}` | No | `[]` | Valid, uniquely named headers inserted into the auth request. Configured values override forwarded headers of the same name. |
| `response_header_allowlist` | array of strings | No | `[]` | Auth-response headers eligible to be copied into the backend request or downstream denial response. Names must be valid and unique. |
| `timeout_ms` | integer | No | `1000` | Total external-auth timeout; must be greater than zero. |
| `failure_mode` | string | No | `fail_closed` | `fail_closed` or `fail_open`. |

Impulse sends an empty-body `GET`. It forwards safe original request headers
and adds `x-impulse-original-method`, `x-impulse-original-path`,
`x-impulse-original-authority` when present, `x-impulse-route-upstream`, and
`x-impulse-backend-address`. Hop-by-hop and framing headers are not forwarded.

Response behavior:

- `2xx` allows the request. Allowlisted response headers may update the backend
  request, except protected headers such as `authorization`, `host`, forwarding,
  framing, redirect, and challenge headers.
- `3xx` is returned as a redirect only when `Location` is present.
- `401` with `WWW-Authenticate` is returned as a challenge.
- other `4xx` responses deny with the auth service's status and body.
- `5xx`, malformed responses, missing redirect metadata, and transport errors
  are provider failures. Auth response bodies are limited to 64 KiB.

`fail_closed` maps timeouts to `504 Gateway Timeout` and other provider errors
to `503 Service Unavailable`. `fail_open` admits only on timeout or provider
error and applies no auth-response mutations. It does not override an explicit
deny, challenge, or redirect.

### OpenID Connect (OIDC) Introspection

```yaml
auth:
  external_auth:
    kind: oidc
    issuer_url: "https://issuer.example.com"
    client_id: "impulse-proxy"
    client_secret_ref:
      ref: "file://oidc-client-secret"
    audience: "impulse-api"
    scopes: ["api:read"]
    timeout_ms: 1000
    failure_mode: fail_closed
```

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `kind` | string | Yes | — | `oidc`. |
| `discovery_url` | string or `null` | Conditionally | `null` | Explicit discovery URL. Takes precedence over `issuer_url` for discovery. |
| `issuer_url` | string or `null` | Conditionally | `null` | Issuer URL used to derive discovery and, when present, to require an exact introspection `iss` match. At least one of `discovery_url` or `issuer_url` is required. |
| `client_id` | string | Yes | — | Non-empty introspection client identifier. |
| `client_secret` | string or `null` | No | `null` | Inline client secret. Mutually exclusive with `client_secret_ref`. |
| `client_secret_ref` | object or `null` | No | `null` | Secret reference for the client secret. |
| `audience` | string or `null` | No | `null` | Expected introspection `aud`; a string or any member of an array may match. |
| `scopes` | array of strings | No | `[]` | Scopes that must all appear in the introspection response's whitespace-separated `scope` string. |
| `request_headers` | array of `{name, value}` | No | `[]` | Additional valid, uniquely named introspection request headers. |
| `response_header_allowlist` | array | No | `[]` | Must remain empty; response-header propagation is not supported for OIDC in v0.6. |
| `timeout_ms` | integer | No | `1000` | Discovery/introspection timeout; must be greater than zero. |
| `failure_mode` | string | No | `fail_closed` | `fail_closed` or `fail_open`, with the same failure semantics as HTTP external auth. |

Discovery, issuer, and introspection endpoints must use HTTPS; loopback HTTP is
accepted for local development. If `discovery_url` is absent, Impulse requests
`<issuer-url>/.well-known/openid-configuration`. Discovery must return an
`introspection_endpoint`.

Discovery metadata is cached for up to five minutes and refreshed after one
minute; a still-valid cached document is served while a background refresh
runs. Impulse posts the bearer token, client ID, optional client secret, and
optional audience to the introspection endpoint. The response must be `2xx`
JSON with `active: true`, then satisfy configured issuer, audience, and scopes.
A missing or malformed bearer credential receives a `401` challenge; inactive
or policy-mismatched tokens receive `403`.

This mode implements discovery and token introspection only. It does not
implement browser redirects, authorization-code exchange, login sessions,
refresh tokens, or session cookies. For local JWT verification against issuer
keys, use `jwt.jwks_url` instead.

## Secret Providers and References

Impulse v0.6 has built-in `literal` and `file` reference schemes. The only
configurable provider kind is `file`:

```yaml
secrets:
  default_provider: runtime_files
  providers:
    runtime_files:
      kind: file
      base_dir: "/run/impulse/secrets"
```

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `default_provider` | string or `null` | No | `null` | Name of the configured file provider whose `base_dir` applies. |
| `providers` | map of objects | No | `{}` | Named provider definitions. Provider names must be non-empty. |
| `providers.<name>.kind` | string | Yes | — | Only `file` is supported. |
| `providers.<name>.base_dir` | string or `null` | No | `null` | Optional non-empty base directory for `file://` references. |

If `default_provider` is set, it must name an entry in `providers`. If it is
omitted and exactly one provider exists, that provider is selected. With zero
providers, or multiple providers and no default, the built-in unrestricted
filesystem resolver is used. Provider names do not appear in reference syntax;
there is one effective file-provider policy.

Reference objects have one field:

```yaml
secret_ref:
  ref: "file://jwt-hs256.key"
```

Accepted, case-sensitive forms are:

- `literal:<value>`: embeds a non-empty value in configuration. This provides
  indirection, not secrecy.
- `file://<path>`: reads a non-empty file of at most 1 MiB. String consumers
  require valid UTF-8; PEM consumers additionally validate their material.

With `base_dir`, file references must be relative, cannot contain `..`, and
must resolve inside the canonical base directory; symlink escapes are rejected.
Without `base_dir`, absolute paths and paths relative to the Impulse process
working directory are accepted.

Secret references are supported by:

| Consumer | Reference field |
| --- | --- |
| JWT `HS256` secret | `upstream.<name>.auth.jwt.secret_ref` |
| OIDC introspection client secret | `upstream.<name>.auth.external_auth.client_secret_ref` |
| Upstream mTLS certificate and key | `upstream.<name>.tls.client_certificate_ref`, `client_key_ref`, and their top-level `upstream_tls` equivalents |
| Legacy Control API bearer token | `observability.control_api.auth_token_ref` |
| Role-bearing Control API bearer token | `observability.control_api.auth.bearer_tokens[].token_ref` |

The corresponding inline value and reference are mutually exclusive. API-key
lists, external-auth `request_headers` values, listener certificates, CA paths,
and other string fields do not become secret-reference-aware merely because a
provider is configured.

## Resolution, Failure, and Reload Behavior

Secret files are resolved while a runtime configuration is normalized. Impulse
does not watch them continuously.

- Startup fails before listeners start if a required reference cannot be
  resolved, is empty, too large, unreadable, outside `base_dir`, invalid UTF-8
  for a string consumer, or invalid PEM for a PEM consumer.
- Control API validate and preview prepare the candidate and therefore resolve
  its references. An error rejects the candidate without changing the active
  runtime generation.
- Activation or the reload endpoint re-reads and resolves the candidate. A
  successful activation installs the newly resolved values atomically; a
  failure leaves the previous generation and its already resolved values in
  service.
- Editing a referenced file alone does nothing. Run the staged
  `validate -> preview -> activate` workflow, or an intentional reload, to load
  the new value. Certificate-specific reload behavior is documented in
  [TLS Setup](/docs/configuration/tls).
- Rollback restores the retained generation; it does not imply a fresh read of
  a changed secret file.
- JWKS is different: its remote public-key cache refreshes in the background
  according to the JWT settings above.

## Field Safety Notes

- Do not place private signing keys in `static_keys`; Impulse needs only public
  verification material for `RS256` and `ES256`.
- Treat `literal:` references, inline API keys, and configured request-header
  values as plaintext configuration secrets.
- Keep `fail_closed` unless an explicit availability decision accepts
  unauthenticated traffic during an authorization-service outage.

File ownership, network segmentation, rotation, and other production posture
belong to the [Security Model](/docs/concepts/security-model).

## Related Pages

- [Configuration Reference](/docs/configuration/reference)
- [TLS Configuration](/docs/configuration/tls)
- [Observability and Control Configuration](/docs/configuration/observability-and-control)
- [Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation)
