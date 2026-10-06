# Quickstart

This page answers one question: **how do I see Impulse proxy a request?** It
uses one local backend, one listener, one route, and a development certificate.

Install the `impulse` binary first by following
[Installation](/docs/getting-started/installation). You also need Python 3,
OpenSSL, and a `curl` build whose feature list includes `HTTP3`.

## 1. Prepare the Demo

Create a disposable directory, a response body, and a development certificate:

```bash
mkdir -p impulse-demo/backend impulse-demo/certs
printf 'hello from Impulse\n' > impulse-demo/backend/index.html
cd impulse-demo

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/server-key.pem \
  -out certs/server-cert.pem \
  -days 7 \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
```

The certificate is only for this isolated demonstration. Use
[TLS Configuration](/docs/configuration/tls) for real certificate and trust
requirements.

## 2. Create the Minimal Configuration

Save this as `config.yaml` in `impulse-demo/`. This is the sole minimal
configuration used by the getting-started guides.

```yaml
version: 1

listen:
  protocol: http3
  address: "127.0.0.1"
  port: 9889
  tls:
    cert: "certs/server-cert.pem"
    key: "certs/server-key.pem"

upstream:
  default:
    route:
      path_prefix: "/"
    backends:
      - id: "demo"
        address: "http://127.0.0.1:8080"
```

The explicit `http://` selects cleartext HTTP/1.1 for the local backend. Impulse
uses verified TLS for backend addresses without that opt-out. See
[Routing and Upstreams](/docs/configuration/routing-and-upstreams) for the exact
transport, routing, and backend rules.

## 3. Start the Backend and Impulse

In one terminal, from `impulse-demo/`:

```bash
python3 -m http.server 8080 --directory backend
```

In a second terminal, from the same directory:

```bash
impulse --config config.yaml
```

A valid configuration continues into listener startup and keeps the process
running. There is no validation-only CLI mode.

## 4. Send an HTTP/3 Request

In a third terminal:

```bash
curl --http3-only --insecure https://localhost:9889/
```

The response should be:

```text
hello from Impulse
```

`--http3-only` prevents fallback to TCP, so this request confirms the native
QUIC listener handled the connection. `--insecure` is appropriate only for the
self-signed development certificate created above.

If the request fails, confirm that `curl --version` lists `HTTP3`, UDP port
`9889` is free, the backend is reachable at `127.0.0.1:8080`, and both
certificate paths are relative to `impulse-demo/`.

## Go Further

- [Docker](/docs/getting-started/docker) for the packaged container workflow
- [Configuration Reference](/docs/configuration/reference) for exact fields and defaults
- [Configuration Examples](/docs/configuration/examples) for non-minimal deployment shapes
- [Production Readiness](/docs/operations/production-readiness) before serving real traffic
- [Troubleshooting](/docs/troubleshooting/common-issues) for symptom-driven diagnosis
