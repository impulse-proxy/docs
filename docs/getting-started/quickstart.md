# Quickstart

This guide builds Impulse v0.7.0 and proxies one request through its production
Pingora HTTP/1.1 ingress. HTTP/3 is optional and experimental.

You need Git, Rust, OpenSSL, Python 3, and `curl`.

## 1. Build Impulse

```bash
git clone --branch v0.7.0 --depth 1 https://github.com/impulse-proxy/impulse.git
cd impulse
cargo build --release --locked -p impulse --bin impulse
```

## 2. Prepare a Local Backend and Certificate

From the Impulse repository root:

```bash
mkdir -p impulse-demo/backend impulse-demo/certs
printf 'hello from Impulse\n' > impulse-demo/backend/index.html

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout impulse-demo/certs/server-key.pem \
  -out impulse-demo/certs/server-cert.pem \
  -days 7 \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
```

The certificate is for local evaluation only.

## 3. Create the Minimal Configuration

Save the following as `impulse-demo/config.yaml`:

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

`protocol: http3` is the current listener schema value. The listener group also
starts production Pingora HTTP/1.1 and HTTP/2 on the same address and port. The
explicit `http://` backend address selects cleartext HTTP/1.1 for this local
demo.

## 4. Start the Backend and Impulse

In the first terminal, from the repository root:

```bash
python3 -m http.server 8080 --directory impulse-demo/backend
```

In a second terminal:

```bash
cd impulse-demo
../target/release/impulse --config config.yaml
```

## 5. Send the First Request

In a third terminal:

```bash
curl --http1.1 --insecure https://localhost:9889/
```

Expected response:

```text
hello from Impulse
```

`--insecure` is appropriate only for the temporary self-signed certificate.
If your `curl` supports HTTP/2, the equivalent production-ingress check is:

```bash
curl --http2 --insecure https://localhost:9889/
```

## Optional: Exercise Experimental HTTP/3

Build and run the repository's HTTP/3 client from the repository root:

```bash
cargo build --release --locked -p impulse-h3-client --bin h3_client
./target/release/h3_client \
  --connect 127.0.0.1:9889 \
  --host localhost \
  --path / \
  --insecure
```

HTTP/3 is experimental in v0.7.0 and should be evaluated separately from the
production H1/H2 path.

## Before Production

Replace the development certificate, review the complete configuration, and
test activation, rollback, draining, backend failure, and monitoring for your
deployment. Start with [Production Deployment](/docs/deployment/production)
and the [Feature and Limitation Matrix](/docs/reference/status-and-limitations).

## Related Pages

- [Installation](/docs/getting-started/installation)
- [Configuration Reference](/docs/configuration/reference)
- [TLS Configuration](/docs/configuration/tls)
- [Operations Runbook](/docs/operations/runbook)
