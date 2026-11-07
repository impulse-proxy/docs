# Plugin Build Profiles

Impulse separates plugin availability from plugin activation:

- Cargo features determine which plugins are **compiled** into the binary.
- The active runtime generation determines which compiled plugins are **active**.

Disabling a plugin at build time removes its implementation and optional
dependencies. It does not make configuration that requires the plugin a no-op.

## Build Profiles

### Full compatibility build

The default build includes every plugin and preserves the behavior of a normal
v0.7 installation:

```bash
cargo build --release --locked -p impulse --bin impulse
```

This is equivalent to enabling `plugins-full`.

### Minimal reverse-proxy build

The minimal profile retains connection-rate limiting and excludes
authentication, scoped rate limiting, quota, response caching, and response
compression:

```bash
cargo build --release --locked -p impulse --bin impulse \
  --no-default-features \
  --features plugins-minimal
```

### Custom build

Disable default features, then list only the required plugin features. For
example, this build includes connection limiting, JWT authentication, and
response compression:

```bash
cargo build --release --locked -p impulse --bin impulse \
  --no-default-features \
  --features "connection-rate-limit,jwt-auth,response-compression"
```

A binary with no plugins can be built with `--no-default-features` and no
`--features` argument. Its configuration must set
`performance.connection_rate_limit_enabled: false` because that setting
defaults to `true`.

## Cargo Features

| Cargo feature | Runtime kind | Configuration that activates it |
| --- | --- | --- |
| `connection-rate-limit` | `connection_rate_limit` | `performance.connection_rate_limit_enabled: true` |
| `api-key-auth` | `api_key_auth` | `upstream.<name>.auth.api_key` is present |
| `jwt-auth` | `jwt_auth` | `upstream.<name>.auth.jwt` is present |
| `external-auth` | `external_auth` | `upstream.<name>.auth.external_auth` is present |
| `scoped-rate-limit` | `scoped_rate_limit` | `resilience.scoped_rate_limits` is non-empty |
| `quota` | `quota` | `resilience.quota.enabled: true` |
| `response-cache` | `response_cache` | `upstream.<name>.cache.enabled: true` |
| `response-compression` | `response_compression` | `upstream.<name>.compression.enabled: true` |
| `plugins-full` | all kinds above | Build-profile alias |
| `plugins-minimal` | `connection_rate_limit` | Build-profile alias |

These are features on the `impulse` binary package. Internal crate features
are implementation details and should not be enabled directly.

## Compiled and Active Plugins

A compiled plugin is available to every prepared generation. It becomes active
only when the current configuration requires it. Compiling the full profile
therefore does not make every plugin run on every request.

The `plugins` object returned by `GET /admin/runtime` reports:

- `compiled`: plugin kinds present in the binary
- `active`: plugin kinds used by the active generation
- `required_but_unavailable`: kinds requested by the most recently rejected
  generation preparation
- `health`: bounded generation-alignment and active-instance status

The status does not expose credentials, cache contents, quota identities, or
plugin-private state.

## Missing Plugins

Startup fails when configuration requires a plugin absent from the binary. A
reload is rejected during candidate preparation, before publication, and the
active generation continues serving unchanged. The rejection identifies the
missing plugin kind and the configuration location that required it.

Impulse never silently ignores configuration because a build feature is
missing. Use the full build when one binary must accept arbitrary supported
v0.7 configurations.

## Empty Plans

Plugin plans are compiled during generation preparation. If a phase has no
active plugins, its request path skips view construction, mutation allocation,
phase iteration, plugin metrics, and asynchronous runner creation. Mandatory
core overload admission is not a plugin and remains active independently.

## Connection-Rate Limiting

Connection-rate limiting is enabled by default:

```yaml
performance:
  connection_rate_limit_enabled: true
  new_connections_per_sec: 2000
  new_connections_burst: 500
```

When `connection_rate_limit_enabled` is `false`, the generation omits the
connection-rate plugin and does not validate its rate or burst values. The
host-owned `max_active_connections` limit remains separate and continues to
apply.

## Related Pages

- [Runtime Architecture](/docs/architecture/overview)
- [Configuration Reference](/docs/configuration/reference)
- [Configuration Defaults](/docs/configuration/defaults)
- [Control API Reference](/docs/reference/control-api-reference)
