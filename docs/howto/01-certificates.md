---
slug: /howto/certificates
---

# Configure Downstream Certificates

Use this checklist after your CA or certificate automation has produced a PEM
certificate chain and matching PEM private key. Impulse does not issue or renew
certificates.

For exact field, SNI, client-auth, and reload semantics, use
[TLS Configuration](/docs/configuration/tls#downstream-listener-tls).

## Configure the Listener Identity

```yaml
listen:
  protocol: http3
  address: "0.0.0.0"
  port: 9889
  tls:
    cert: "/etc/impulse/tls/server-chain.pem"
    key: "/etc/impulse/tls/server-key.pem"
```

- Put the leaf certificate first and any intermediate certificates after it in
  `cert`.
- Use a PEM private key that matches the leaf certificate.
- Make both files readable by the Impulse runtime user; restrict private-key
  access to that user or group.
- Use absolute paths in service-managed deployments so the process working
  directory cannot change path resolution.

For multiple names, add exact `certificates[].server_name` mappings. Keep a
`cert`/`key` pair as the explicit fallback, or understand that the first array
entry becomes the fallback when the pair is absent.

## Apply Certificate Content Changes

Replace the files atomically at their configured paths, then call the
authenticated Control API endpoint:

```bash
curl --http1.1 -X POST https://127.0.0.1:9902/admin/runtime/reload-certs \
  -H "Authorization: Bearer <token>"
```

A successful reload updates new native QUIC and bootstrap TLS handshakes only.
Existing connections continue unchanged. The operation stages every active
listener and installs none of them if any certificate, key, or downstream
client-auth CA fails to load.

To change paths, SNI mappings, or downstream client-auth policy, run the
Control API `validate → preview → activate` workflow first, then call
`reload-certs`.

## Development Only

The small self-signed example in
[TLS Configuration](/docs/configuration/tls#optional-development-certificate)
is sufficient for isolated local testing. Use your organization's existing PKI
or certificate automation for production issuance and renewal.

## Related Pages

- [Secret and Certificate Rotation](/docs/operations/secret-and-cert-rotation)
- [Control API Reference](/docs/reference/control-api-reference#post-adminruntimereload-certs)
- [Security Model](/docs/concepts/security-model)
