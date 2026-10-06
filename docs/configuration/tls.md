# TLS Configuration

This page is the focused Impulse v0.6 reference for downstream listener TLS
and upstream backend TLS. The general
[Configuration Reference](/docs/configuration/reference) remains the schema
authority. For rotation procedures, see
[Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation).

## Keep the Two Directions Separate

| Direction | Impulse role | Configuration | Purpose |
| --- | --- | --- | --- |
| Downstream client → Impulse | TLS server | `listen.tls` or `listeners[].tls` | Selects the certificate Impulse presents and optionally verifies client certificates. |
| Impulse → upstream backend | TLS client | top-level `upstream_tls` or `upstream.<name>.tls` | Verifies backend certificates and optionally presents an Impulse client certificate. |

Downstream certificate settings do not configure backend trust. Upstream CA or
client-certificate settings do not change the certificates presented to
downstream clients. Control API mTLS is another admin-plane policy documented
in the [Control API Reference](/docs/reference/control-api-reference).

## Downstream Listener TLS

Every effective listener needs a default TLS identity. Configure either the
`cert`/`key` pair, one or more `certificates` entries, or both.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `cert` | string | Conditionally | `""` | PEM certificate-chain file for the default identity. Must be paired with `key`. |
| `key` | string | Conditionally | `""` | PEM private-key file for the default identity. Must be paired with `cert`. |
| `certificates` | array of objects | No | `[]` | Additional exact-SNI identities. At least one entry is required when `cert`/`key` is absent. |
| `certificates[].server_name` | string | Yes | — | DNS name used as an exact SNI map key. |
| `certificates[].cert` | string | Yes | — | PEM certificate-chain file for this identity. |
| `certificates[].key` | string | Yes | — | PEM private-key file for this identity. |
| `client_auth` | object | No | `{}` | Downstream client-certificate policy. |
| `client_auth.enabled` | boolean | No | `false` | Requests and verifies a client certificate against `ca_file`. |
| `client_auth.require_client_cert` | boolean | No | `false` | Rejects a client that does not present a certificate. Requires `enabled: true`. |
| `client_auth.ca_file` | string or `null` | Conditionally | `null` | PEM CA bundle used to verify downstream client certificates. Required when client auth is enabled. |

Listener certificate, key, and client-CA fields are filesystem paths; they do
not accept secret-reference objects. Paths may be absolute or relative to the
Impulse process working directory. Each PEM file must be a regular readable
file no larger than 1 MiB.

### Default identity

```yaml
listen:
  protocol: http3
  address: "0.0.0.0"
  port: 9889
  tls:
    cert: "/etc/impulse/tls/default-chain.pem"
    key: "/etc/impulse/tls/default-key.pem"
```

The certificate file may contain a leaf followed by intermediate certificates.
The private key must be a supported PEM private key and must match the leaf
certificate. Impulse rejects unreadable, empty, malformed, expired, or
not-yet-valid identities before they become active.

### SNI identities and selection

```yaml
listen:
  protocol: http3
  address: "0.0.0.0"
  port: 9889
  tls:
    cert: "/etc/impulse/tls/default-chain.pem"
    key: "/etc/impulse/tls/default-key.pem"
    certificates:
      - server_name: "api.example.com"
        cert: "/etc/impulse/tls/api-chain.pem"
        key: "/etc/impulse/tls/api-key.pem"
      - server_name: "www.example.com"
        cert: "/etc/impulse/tls/www-chain.pem"
        key: "/etc/impulse/tls/www-key.pem"
```

Selection is identical on the native QUIC listener and bootstrap listener:

1. Use an exact normalized match between the client's SNI name and a
   `certificates[].server_name` entry.
2. Otherwise use the `cert`/`key` identity.
3. If that pair is absent, use the first `certificates[]` entry as the default.

No SNI and unmatched SNI both use the default identity. A `server_name` is
trimmed, converted to IDNA ASCII, lowercased, and stripped of a trailing dot.
It must be a DNS hostname: IP addresses, ports, whitespace, and `*` are
rejected. Names must be unique after normalization.

The mapped certificate's SANs must cover its `server_name`. A SAN wildcard such
as `*.example.com` may cover one label, but the configured `server_name` itself
is always exact; `server_name: "*.example.com"` is invalid.

### Downstream client authentication

```yaml
listen:
  protocol: http3
  address: "0.0.0.0"
  port: 9889
  tls:
    cert: "/etc/impulse/tls/server-chain.pem"
    key: "/etc/impulse/tls/server-key.pem"
    client_auth:
      enabled: true
      require_client_cert: true
      ca_file: "/etc/impulse/tls/client-ca.pem"
```

When `enabled: true`, Impulse verifies a presented client chain against the
certificates in `ca_file` on both native QUIC and bootstrap TLS handshakes.

- `require_client_cert: false` makes presentation optional, but rejects an
  invalid certificate when one is presented.
- `require_client_cert: true` rejects both a missing certificate and an invalid
  certificate during the TLS handshake.
- `require_client_cert: true` with `enabled: false`, or enabled client auth
  without a non-empty CA file, is invalid configuration.

This policy protects downstream application traffic. It is not the Control API
client-auth policy under `observability.control_api.tls.client_auth`.

## Downstream Reload Behavior

`POST /admin/runtime/reload-certs` reloads every active listener's configured
certificate chains, private keys, and downstream client-auth CA material.

- Reload is staged across all listeners. If any identity or CA fails to load,
  none of the staged listener TLS states is installed.
- A successful reload affects new native QUIC handshakes and new bootstrap TLS
  sessions. Existing QUIC connections, bootstrap TLS sessions, and multiplexed
  HTTP/2 streams continue with their negotiated state.
- Replacing files at the existing paths requires `reload-certs`; file changes
  are not watched automatically.
- To change listener TLS paths, SNI mappings, or client-auth policy, first use
  the runtime `validate → preview → activate` workflow, then call
  `reload-certs` so the active listener TLS store loads the new configuration.
  A listener bind removal or bind-address change still requires restart.
- `reload-certs` does not reload upstream trust roots or upstream client
  identities.

The endpoint requires Control API authorization. See the
[Control API Reference](/docs/reference/control-api-reference#post-adminruntimereload-certs)
for its request and response contract.

## Upstream Backend TLS

Upstream TLS policy applies only to `https://` backends. The top-level
`upstream_tls` object is inherited by an upstream whose `tls` field is absent.
When `upstream.<name>.tls` is present, it replaces the complete top-level policy;
the two objects are not merged. An `http://` backend is cleartext and does not
use the TLS policy.

| **Field** | **Type** | **Required** | **Default** | **Meaning** |
| --------- | -------- | ------------ | ----------- | ----------- |
| `verify_certificates` | boolean | No | `true` | Verifies the backend certificate chain and backend identity. |
| `strict_sni` | boolean | No | `true` | Sends the backend hostname in the TLS SNI extension. |
| `ca_file` | string or `null` | No | `null` | PEM CA bundle added to the default WebPKI roots. |
| `ca_dir` | string or `null` | No | `null` | Directory of PEM CA files added to the default WebPKI roots. |
| `client_certificate` | string or `null` | Conditionally | `null` | Filesystem path to the PEM client-certificate chain Impulse presents to the backend. |
| `client_certificate_ref` | object or `null` | Conditionally | `null` | Secret reference for the client-certificate chain. Mutually exclusive with `client_certificate`. |
| `client_key` | string or `null` | Conditionally | `null` | Filesystem path to the PEM client private key. |
| `client_key_ref` | object or `null` | Conditionally | `null` | Secret reference for the client private key. Mutually exclusive with `client_key`. |

### Server verification and CA behavior

With `verify_certificates: true`, Impulse starts with the built-in WebPKI root
set and adds certificates from `ca_file` and `ca_dir`. Custom roots augment the
public roots; they do not replace them. The backend certificate must chain to a
trusted root and match the host in the backend URL.

`ca_file` must be a non-empty readable PEM certificate bundle no larger than
1 MiB. `ca_dir` must be a readable directory containing at least one
certificate in files ending in `.pem`, `.crt`, or `.cer`, or their uppercase
equivalents. Each loaded file is limited to
1 MiB. Other directory entries are ignored.

`strict_sni: false` only suppresses the SNI extension. When certificate
verification is enabled, chain and backend-identity verification remain active.
`verify_certificates: false` disables backend certificate-chain and identity
verification and should be limited to controlled development or emergency use.
It does not turn HTTPS into cleartext.

```yaml
upstream_tls:
  verify_certificates: true
  strict_sni: true
  ca_file: "/etc/impulse/tls/private-root-ca.pem"

upstream:
  payments:
    route:
      path_prefix: "/payments"
    backends:
      - id: "payments-1"
        address: "https://payments.internal:8443"
```

### Upstream client mTLS

An upstream client identity is a complete certificate/key pair. Either side of
the pair may use a path or a secret reference independently, but each field and
its `_ref` counterpart are mutually exclusive. At least one backend in the
upstream must use HTTPS.

Path-backed example:

```yaml
upstream:
  payments:
    route:
      path_prefix: "/payments"
    tls:
      verify_certificates: true
      strict_sni: true
      ca_file: "/etc/impulse/tls/backend-ca.pem"
      client_certificate: "/etc/impulse/tls/payments-client-chain.pem"
      client_key: "/etc/impulse/tls/payments-client-key.pem"
    backends:
      - id: "payments-1"
        address: "https://payments.internal:8443"
```

File-backed secret example:

```yaml
secrets:
  default_provider: tls_files
  providers:
    tls_files:
      kind: file
      base_dir: "/run/impulse/secrets"

upstream:
  payments:
    route:
      path_prefix: "/payments"
    tls:
      verify_certificates: true
      ca_file: "/etc/impulse/tls/backend-ca.pem"
      client_certificate_ref:
        ref: "file://payments/client-chain.pem"
      client_key_ref:
        ref: "file://payments/client-key.pem"
    backends:
      - id: "payments-1"
        address: "https://payments.internal:8443"
```

The certificate source must contain at least one PEM certificate; the first is
the leaf and the remainder form its chain. The key must be a parseable PEM
private key matching the certificate. Secret-reference syntax, `base_dir`
containment, size limits, and failure behavior are documented in
[Authentication and Secrets](/docs/configuration/authentication-and-secrets#secret-providers-and-references).

## Upstream TLS Activation and Rotation

Upstream TLS is runtime-generation-owned:

- Use Control API `validate → preview → activate` for changes to upstream CA
  material, verification/SNI settings, and client mTLS material.
- Candidate preparation reads CA files and directories, resolves client
  certificate/key references, parses the PEM material, and fingerprints it.
  Failure rejects the candidate and leaves the active generation unchanged.
- A successful activation rebuilds the affected backend transport pool. New
  backend connections use the new policy; `reload-certs` is not involved.
- Same-path file replacement is detected because candidate preparation hashes
  loaded CA and client-identity content, not only path strings.
- Rollback restores the retained generation and its already loaded TLS
  material. It does not re-read the current files.

See [Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation)
for the operator sequence and rollback cautions.

## Optional Development Certificate

For an isolated local listener, a short-lived self-signed certificate is
sufficient. This command creates a PEM certificate and key with a localhost SAN:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 7 \
  -keyout certs/server.key -out certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

```yaml
listen:
  protocol: http3
  address: "127.0.0.1"
  port: 9889
  tls:
    cert: "certs/server.crt"
    key: "certs/server.key"
```

This is development material, not a production certificate-management
workflow. Impulse does not issue or renew certificates.

## Operational Signals

Relevant metrics include:

- `impulse_downstream_tls_handshake_failure_total{listener,reason}`
- `impulse_downstream_tls_certificate_selection_total{listener,selection}`
- `impulse_downstream_tls_alpn_total{listener,protocol}`
- `impulse_downstream_tls_certificate_not_after_seconds{listener,server_name}`
- `impulse_downstream_tls_certificate_days_remaining{listener,server_name}`
- `impulse_upstream_tls_failure_total{upstream,backend,phase,reason}`
- `impulse_upstream_client_certificate_not_after_seconds{upstream}`
- `impulse_upstream_client_certificate_days_remaining{upstream}`
- `impulse_control_plane_cert_reload_total{result,reason}`

Use the [Metrics Reference](/docs/reference/metrics-reference) for exact metric
semantics and the [Runbook](/docs/operations/runbook) for diagnosis.
