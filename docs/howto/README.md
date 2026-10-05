# How-To Guides

Step-by-step guides for common Impulse tasks.

| Guide | What it covers |
|-------|---------------|
| [01-certificates.md](/docs/howto/01-certificates) | Setting up TLS certificates — mkcert (dev), OpenSSL self-signed, Let's Encrypt (production), multi-domain SNI, browser trust |
| [02-configuration.md](/docs/howto/02-configuration) | Building a complete config file — listeners, upstreams, routing, load balancing, health checks, host policy, forwarded headers, performance tuning |
| [03-run.md](/docs/howto/03-run) | Running Impulse — directly, as a systemd service, in Docker; startup sequence, health checks, graceful shutdown, troubleshooting |

## Quick path for first-time setup

1. **Generate certificates** → [01-certificates.md](/docs/howto/01-certificates)
2. **Write your config** → [02-configuration.md](/docs/howto/02-configuration) (or copy `config/config.reverse.yaml`)
3. **Start Impulse** → [03-run.md](/docs/howto/03-run)
