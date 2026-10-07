# Protocol Support

This page describes the protocol behavior implemented by Impulse v0.6. It is
a support contract, not a QUIC or HTTP tutorial. For protocol definitions, use
the RFC links at the end of the page.

## Ingress Protocols

Each configured listener exposes two ingress paths on the same address and
port number:

| Ingress | Network and security | HTTP version | Purpose |
| --- | --- | --- | --- |
| Native QUIC listener | UDP, QUIC, and TLS 1.3 | HTTP/3 | Primary data path |
| Bootstrap listener | TCP and TLS | HTTP/2 or HTTP/1.1 | Compatibility and HTTP/3 discovery path |

Both paths use the same active runtime generation, routing, admission,
backend-selection, and upstream transport services. Only connection handling,
request decoding, and response writeback are protocol-specific.

Impulse does not provide a cleartext HTTP/1.1 listener or h2c ingress. Opening
only the UDP port is also insufficient for compatibility clients: production
network policy should allow both UDP and TCP on the listener port.

## Application-Layer Protocol Negotiation (ALPN) and HTTP/3 Discovery

The native listener advertises `h3`. A client must negotiate HTTP/3 over QUIC;
arbitrary QUIC application protocols are not accepted.

The bootstrap TLS listener advertises ALPN in this preference order:

1. `h2`
2. `http/1.1`

If `h2` is negotiated, the bootstrap connection uses HTTP/2. Otherwise, the
accepted bootstrap request path uses HTTP/1.1. Bootstrap responses advertise
the native listener with:

```http
Alt-Svc: h3=":<listener-port>"; ma=86400
```

`Alt-Svc` enables a compatible client to discover HTTP/3; it does not redirect
the current request or guarantee that a client switches protocols.

## QUIC and HTTP/3 Limits

The configurable limits below are documented fully in the
[Configuration Reference](/docs/configuration/reference). Values shown are the
v0.6 defaults.

| Configuration field | Default | Effect |
| --- | ---: | --- |
| `performance.quic_max_idle_timeout_ms` | `5000` | Closes an idle QUIC connection after the negotiated timeout |
| `performance.quic_initial_max_data` | `10000000` | Initial connection-level receive window in bytes |
| `performance.quic_initial_max_stream_data` | `1000000` | Initial per-stream receive window in bytes |
| `performance.quic_initial_max_streams_bidi` | `100` | Initial concurrent bidirectional-stream limit and request-stream guardrail |
| `performance.quic_initial_max_streams_uni` | `100` | Initial concurrent unidirectional-stream limit |
| `performance.max_active_connections` | `20000` | Maximum tracked QUIC connections per worker |
| `performance.max_request_body_bytes` | `1000000` | Request-body limit; must not exceed the per-stream receive window |
| `resilience.protocol.max_headers_count` | `128` | Maximum request-header count |
| `resilience.protocol.max_headers_bytes` | `16384` | Maximum aggregate request-header bytes |

Impulse also sets the QUIC send and receive UDP payload size to 1,350 bytes.
New QUIC connections are subject to the configured connection-rate token bucket
and active-connection cap. Existing connection traffic is not charged against
the new-connection token bucket.

Request and response body limits, buffering limits, header checks, timeouts,
admission limits, and drain deadlines apply in addition to QUIC flow control.
A transport window is therefore not permission to buffer or proxy the same
number of application bytes.

Active QUIC connection migration is disabled. A client must establish a new
connection after a network-path change rather than relying on Impulse to
validate and migrate the existing path.

## Zero Round Trip Time (0-RTT) and Early Data

Early data is disabled by policy by default:

```yaml
resilience:
  protocol:
    allow_0rtt: false
    early_data_safe_methods: [GET, HEAD]
```

When the QUIC/TLS layer reports a request as early data, Impulse accepts it only
when `allow_0rtt` is true and the normalized method is in
`early_data_safe_methods`. Configuration validation permits only `GET` and
`HEAD` in that list when 0-RTT is enabled. A request that fails the policy is
rejected with `425 Too Early` and is not routed upstream.

Enabling the policy does not make early data replay-safe and does not guarantee
that a client session negotiates 0-RTT. Operators must ensure that every
affected route is safe to replay and should monitor the early-data accepted and
rejected counters in the [Metrics Reference](/docs/reference/metrics-reference).

## CONNECT and WebSocket Behavior

CONNECT is disabled by default. Enabling it requires
`resilience.protocol.allow_connect: true`; optional exact authority and port
allowlists further constrain targets. A route that explicitly matches
`CONNECT` is rejected during configuration validation unless CONNECT is
enabled.

Support is deliberately narrower than a general-purpose tunneling proxy:

| Downstream request | Current behavior |
| --- | --- |
| HTTP/3 ordinary CONNECT | Validated against CONNECT policy and routed through the selected upstream; treat it as constrained support, not arbitrary forward-proxy support |
| HTTP/3 WebSocket | Requires extended CONNECT with `:protocol = websocket`; legacy `Upgrade` headers are rejected on HTTP/3 |
| Bootstrap HTTP/1.1 WebSocket | Recognizes a `GET` request with `Connection: upgrade` and `Upgrade: websocket` |
| Bootstrap HTTP/2 WebSocket | Not handled as an HTTP/1.1 upgrade path |

The dedicated HTTP/1.1 WebSocket tunnel path requires an explicit
`http://` backend. HTTP/3 extended CONNECT can be shaped for an HTTP/2 backend,
but successful end-to-end operation still depends on that backend supporting
extended CONNECT. Upgrade and CONNECT traffic does not have feature parity
across every downstream/backend protocol combination; validate the exact pair
before production use.

## Backend Protocols

Downstream protocol does not determine backend protocol. Impulse selects the
backend transport from the normalized backend address:

| Backend address | Upstream behavior |
| --- | --- |
| `http://host[:port]` | Cleartext HTTP/1.1; default port `80` |
| `https://host[:port]` | HTTP/2 over TLS; default port `443` |
| `host:port` or schemeless hostname | HTTP/2 over TLS; HTTPS is the default |

HTTP/1.1 and HTTP/2 connections use separate internal pools behind the shared
transport façade. Impulse does not forward to backends over HTTP/3.

## Known Unsupported or Partial Features

- Upstream HTTP/3 is not implemented.
- Cleartext HTTP/1.1 ingress and h2c ingress are not implemented.
- Active QUIC connection migration is disabled.
- HTTP/3 server push is not implemented.
- HTTP/3 priority updates are accepted by the library event loop but do not
  influence scheduling or backend priority.
- HTTP datagrams and WebTransport are not implemented.
- HTTP/3 rejects HTTP/1.1-style `Upgrade` requests; WebSocket uses extended
  CONNECT instead.
- Bootstrap HTTP/2 does not provide the bootstrap HTTP/1.1 WebSocket upgrade
  path.
- General CONNECT and WebSocket support remains protocol-pair dependent rather
  than a universal tunneling surface.

For broader product status, see
[Status and Limitations](/docs/reference/status-and-limitations).

## Standards

- [RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport](https://www.rfc-editor.org/rfc/rfc9000)
- [RFC 9001: Using TLS to Secure QUIC](https://www.rfc-editor.org/rfc/rfc9001)
- [RFC 9002: QUIC Loss Detection and Congestion Control](https://www.rfc-editor.org/rfc/rfc9002)
- [RFC 7301: TLS Application-Layer Protocol Negotiation](https://www.rfc-editor.org/rfc/rfc7301)
- [RFC 8446: TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 9113: HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [RFC 9114: HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
- [RFC 9204: QPACK](https://www.rfc-editor.org/rfc/rfc9204)
- [RFC 8441: Bootstrapping WebSockets with HTTP/2](https://www.rfc-editor.org/rfc/rfc8441)
- [RFC 9220: Bootstrapping WebSockets with HTTP/3](https://www.rfc-editor.org/rfc/rfc9220)

## Related Pages

- [Architecture Overview](/docs/architecture/overview)
- [Transport and Backend Lifecycle](/docs/architecture/transport-and-backend-lifecycle)
- [TLS Configuration](/docs/configuration/tls)
- [Resilience Configuration](/docs/configuration/resilience)
