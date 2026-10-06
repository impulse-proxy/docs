# Installation

This page answers one question: **how do I install Impulse correctly on a
host?** Use the Debian package when one is available for your release and
architecture; build from source when you need a development binary or no
package matches the host.

Impulse v0.6 supports Linux as its production runtime. macOS is suitable for
local development; Windows is not a supported runtime platform. Use an
unprivileged service account and a port above `1024`, or grant only
`CAP_NET_BIND_SERVICE` when binding a privileged port.

## Install a Release Package

Download the package for your version and architecture from
[GitHub Releases](https://github.com/impulse-proxy/impulse/releases). Package
filenames are versioned rather than fixed:

```text
impulse_<version>_amd64.deb
impulse_<version>_arm64.deb
```

Install the downloaded file:

```bash
sudo dpkg -i "impulse_<version>_<architecture>.deb"
```

The package installs:

| Path | Purpose |
| --- | --- |
| `/usr/bin/impulse` | Executable |
| `/etc/impulse/config.yaml` | Package-managed configuration file |
| `/etc/impulse/certs/` | Operator-managed certificate directory |
| `/var/log/impulse/` | File-log directory |
| `/lib/systemd/system/impulse.service` | Systemd unit |

It also creates the `impulse` system user and group and enables the service.
A fresh installation may fail its first start until you provide the configured
certificate files and replace the placeholder backend. This is expected; read
the reason with:

```bash
sudo journalctl -u impulse -n 50 --no-pager
```

Keep private keys owned by `root:impulse`, readable by the group, and not
world-readable. Use [TLS Configuration](/docs/configuration/tls) for exact
certificate, SNI, client-authentication, and reload behavior. Use
[Configuration Examples](/docs/configuration/examples) to replace the packaged
placeholder configuration.

After provisioning the config and certificates, start the installed unit and
inspect its status:

```bash
sudo systemctl restart impulse
sudo systemctl status impulse
```

## Build and Install From Source

Building requires Rust 1.85 or newer and the native toolchain used by the QUIC
and TLS dependencies.

On Debian or Ubuntu:

```bash
sudo apt update
sudo apt install -y build-essential clang cmake libclang-dev ninja-build pkg-config perl
```

On Fedora or RHEL-family systems, install the equivalent C/C++ compiler,
Clang, CMake, Ninja, pkg-config, and Perl packages. On macOS:

```bash
brew install cmake ninja pkg-config rust
```

Clone and build once:

```bash
git clone https://github.com/impulse-proxy/impulse.git
cd impulse
cargo build --release --locked -p impulse --bin impulse
```

For a local evaluation, run `target/release/impulse` directly. For a host-wide
installation:

```bash
sudo install -m 0755 target/release/impulse /usr/local/bin/impulse
```

A manual installation does not create a service account, configuration tree,
or systemd unit. Use the repository package script to produce a native package,
or follow [Production Deployment](/docs/deployment/production) for the service
layout and host hardening. Do not copy a second systemd example from this page.

## Confirm the Installation

Confirm that the installed executable can start its CLI without loading a
configuration:

```bash
impulse --version
impulse --help
```

The executable has three core options:

| Option | Meaning |
| --- | --- |
| `--config <path>` / `-c <path>` | Load the configuration at `path` and start Impulse. |
| `--version` / `-V` | Print the executable version and exit. |
| `--help` / `-h` | Print command help and exit. |

These commands verify the executable, not a configuration. `impulse --config`
is a server start command: a valid configuration proceeds to runtime and binds
listeners. Validate a candidate through controlled non-production startup or
the Control API `validate → preview → activate` flow described in
[Production Rollout and Validation](/docs/deployment/production#rollout-and-validation).

## Next Step

Use the [Quickstart](/docs/getting-started/quickstart) for the single minimal
configuration and first proxied request. Before serving real traffic, continue
with [Production Deployment](/docs/deployment/production).
