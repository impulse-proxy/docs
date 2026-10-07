# Secret and Certificate Rotation

This runbook covers listener certificates, upstream client identities,
certificate authority (CA) trust, and secret-backed configuration.

Read [Reload and Drain](/docs/operations/reload-and-drain) for the distinction
between `reload-certs` and generation activation.

## Which Path Applies

| Material | Path | Why |
| --- | --- | --- |
| Downstream listener cert/key or client-auth CA content at configured paths | `POST /admin/runtime/reload-certs` | Listener-scoped hot swap; does not create a runtime generation |
| Downstream TLS path, Server Name Indication (SNI) mapping, or client-auth policy change | `validate` → `preview` → `activate` → `reload-certs` | Activates the configuration, then reloads its listener TLS material |
| Upstream client certificate/key for mutual TLS (mTLS) | `validate` → `preview` → `activate` | Generation-owned; rebuilds the affected backend connection pool |
| Upstream CA bundle (`ca_file`/`ca_dir`) | `validate` → `preview` → `activate` | Generation-owned; same reasoning as client cert/key |
| Upstream `verify_certificates` or `strict_sni` | `validate` → `preview` → `activate` | Generation-owned backend transport policy |
| `secrets.providers` registry shape | `validate` → `preview` → `activate` | Generation-owned config, not a listener concern |

Upstream TLS material is never rotated through `reload-certs`, even when the
change is "just a certificate." `reload-certs` is intentionally narrow: it
stages every active listener identity and listener client-auth CA, then swaps
the listener TLS states only if all of them load successfully. Upstream client
identity and upstream trust roots always go through runtime activation so the
change gets a diff, generation number, and rollback semantics.

## Secret References

Prefer file-backed secret references over plaintext values for anything sensitive:

```yaml
secrets:
  default_provider: local_filesystem
  providers:
    local_filesystem:
      kind: file
      base_dir: "/etc/impulse/secrets"

upstream:
  payments:
    tls:
      client_certificate_ref:
        ref: "file://upstream/payments-client.crt"
      client_key_ref:
        ref: "file://upstream/payments-client.key"
```

A `_ref` field and its plaintext sibling are mutually exclusive. This applies
to client certificates and keys, authentication secrets, client secrets,
Control API tokens, and bearer tokens. Supported reference schemes are
`literal:<value>` and `file://<path>`.

Listener `cert`, `key`, and `client_auth.ca_file` fields are paths and do not
accept secret-reference objects. See
[TLS Configuration](/docs/configuration/tls#upstream-client-mtls) for the exact
upstream mTLS field contract and
[Authentication and Secrets](/docs/configuration/authentication-and-secrets#secret-providers-and-references)
for reference resolution.

Secret references resolve while a runtime candidate is prepared, not on the
first request. A missing, unreadable, empty, or malformed file rejects
`validate`, `preview`, or `activate` before the candidate becomes active.

## Downstream Listener Certificate Rotation

1. Replace the certificate and key with an atomic rename. See
   [Secret File Replacement Safety](#secret-file-replacement-safety).
2. Call:

   ```bash
   curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/reload-certs \
     -H "Authorization: Bearer <token>"
   ```

   Use the configured `observability.control_api.reload_certs_path`; the
   default is `/admin/runtime/reload-certs`.
3. Confirm the new certificate under `tls.listeners.<listener>` in
   `GET /admin/runtime`.
4. Confirm the successful reload counter and certificate-expiry metrics.

The reload includes all configured default and SNI identities plus downstream
client-auth CA files. It does not rebuild the runtime generation, mutate
route/policy state, or affect already-negotiated sessions—only new native QUIC
and bootstrap TLS handshakes see the new material. If any listener fails to
load, none of the staged listener TLS states is installed.

## Upstream Client Certificate Rotation (mTLS)

1. Write the new client certificate and key with an atomic rename.
2. Run the staged activation flow. Keep the same reference for an in-place
   rotation, or update the reference when the path changes:

   ```bash
   curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/validate \
     -H "Authorization: Bearer <token>" -H "content-type: application/json" \
     -d '{"requested_by":"<actor>","reason":"rotate client certificate"}'

   curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/preview \
     -H "Authorization: Bearer <token>" -H "content-type: application/json" \
     -d '{"requested_by":"<actor>","reason":"preview client certificate rotation"}'

   curl --http1.1 --cacert <path> -X POST https://<control-host>:<port>/admin/runtime/activate \
     -H "Authorization: Bearer <token>" -H "content-type: application/json" \
     -d '{"expected_generation":<generation>,"requested_by":"<actor>","reason":"rotate client certificate"}'
   ```

3. Confirm the new generation and `secret_material_changed: true` in
   `GET /admin/runtime/history`.
4. Confirm new upstream mTLS handshakes use the rotated identity and
   `impulse_upstream_tls_failure_total` remains stable.

Activation detects a content change at the same `file://` path and reports
`secret_material_changed: true`; a new reference is not required.

## Upstream CA Rotation

Upstream CA rotation uses the same `validate → preview → activate` flow because
it is generation-owned. Custom CA material augments the built-in WebPKI roots;
it does not replace them.

For safe overlap during a CA transition:

1. Stage the new CA alongside the old one in `ca_file` or `ca_dir`.
2. Activate with both CAs trusted. Confirm upstream connections still succeed against backends serving certs from either CA.
3. Once all backends have rotated to certs signed by the new CA, remove the old CA and activate again.
4. Roll back (see below) if backend handshakes start failing at any step — do not proceed to the next step under active failures.

Do not remove the old CA until every backend has rotated.

## Secret File Replacement Safety

Prefer an atomic rename into place over in-place truncate-and-write for any file a `file://` secret reference points at:

```bash
# Run with privileges that can replace the root-owned destination.
sudo install -o root -g impulse -m 0640 <source-path> <path>
```

`install`, `mv` within the same filesystem, or an equivalent atomic rename
prevents readers from observing a partially written file. In-place writes can
make activation read an empty or malformed file.

## Rollback Expectations

Runtime rollback restores a retained generation and its resolved secret
material. It does not reread or restore external secret files.

Concretely:

- deleting or overwriting a referenced file after activation does not alter a retained generation's resolved material
- rollback succeeds only while that complete generation remains in the bounded in-memory history; process restart loses that retained runtime bundle
- do not treat runtime history as durable secret backup or versioning; restore the intended file content before the next activation or process restart

Before relying on rollback as your recovery path, confirm the target generation
is still retained. Restore the previous file content as well if a later restart
or fresh activation may be required.

## Failure Handling

When a secret or cert rotation does not behave as expected, inspect in this order:

1. **`GET /admin/runtime`:** check listener, upstream, and secret state for the
   affected scope. Runtime views omit secret references and contents.
2. **`GET /admin/runtime/history`:** confirm the activation result and inspect
   `rejected_changes`. Rejection leaves the active generation unchanged.
3. **Audit logs** — look for these action values:

   | Action | Meaning |
   | --- | --- |
   | `cert_reload_applied` | listener cert reload succeeded |
   | `secret_resolution_failed` | a secret reference failed to resolve during activation (missing file, bad permissions, malformed PEM, etc.) |
   | `upstream_mtls_material_changed` | an activation changed upstream client cert/key or CA fingerprint |
   | `upstream_mtls_material_invalid` | an activation was rejected because upstream TLS material was invalid |

4. **TLS and secret metrics**:

   | Metric | Use |
   | --- | --- |
   | `impulse_secret_reload_total{scope,result,reason}` | reload attempts by scope (`listeners`/`upstreams`) and outcome |
   | `impulse_secret_resolve_total{provider,result,reason}` | resolution attempts by provider and outcome |
   | `impulse_secret_last_success_unixtime{scope}` | staleness — how long since the last successful resolve for a scope |
   | `impulse_upstream_tls_failure_total{upstream,backend,phase,reason}` | live TLS/mTLS handshake failures against a rotated or misconfigured identity, by request phase |
   | `impulse_upstream_client_certificate_not_after_seconds{upstream}` | absolute expiry timestamp per upstream |
   | `impulse_upstream_client_certificate_days_remaining{upstream}` | days-remaining gauge for alerting ahead of expiry |
   | `impulse_control_plane_cert_reload_total{result,reason}` | listener cert reload outcomes |

None of the control-plane JSON, audit events, or metrics expose secret contents, private key bytes, secret references, provider base directories, or JWKS endpoint URLs.

## Related Pages

- [Reload and Drain](/docs/operations/reload-and-drain)
- [Authentication and Secrets](/docs/configuration/authentication-and-secrets)
- [Runbook](/docs/operations/runbook)
- [Control API Reference](/docs/reference/control-api-reference)
- [TLS Configuration](/docs/configuration/tls)
- [Metrics Reference](/docs/reference/metrics-reference)
