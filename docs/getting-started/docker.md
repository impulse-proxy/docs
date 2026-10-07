# Docker

This page answers one question: **how do I run the Impulse container?**

## Image Availability

The Impulse v0.6 repository does not define a registry-publication
workflow or a public image reference. Do not guess a Docker Hub or GHCR image
name: an image with the same project name may be unrelated. The supported v0.6
container artifact is the production Dockerfile under `packaging/docker/`,
which produces the local image `impulse:packaging`.

When an official release publishes a container, use the exact immutable tag or
digest listed on that release. The run contract below remains the same: mount a
configuration at `/etc/impulse/config.yaml`, mount its certificate files, and
publish both UDP and TCP for the listener port.

## Build the Packaged Image

From an existing Impulse source checkout:

Run Docker commands as a user authorized to access the Docker daemon. Do not
add `sudo` by default; use the host's documented Docker access policy.

```bash
./packaging/docker/scripts/build-image.sh
```

This builds `packaging/docker/Dockerfile` and tags the result
`impulse:packaging`. The image runs as UID `10001`, uses
`/var/lib/impulse` as its working directory, and starts:

```text
/usr/local/bin/impulse --config /etc/impulse/config.yaml
```

## Provide Configuration and Certificates

Use `packaging/docker/config.docker.yaml` as the container-specific starting
point, or mount a configuration prepared from
[Configuration Examples](/docs/configuration/examples). The single minimal
learning configuration lives in the
[Quickstart](/docs/getting-started/quickstart#2-create-the-minimal-configuration);
it is not duplicated here because container paths and backend reachability must
match your deployment.

Requirements:

- the config file is readable at `/etc/impulse/config.yaml`
- every certificate, key, certificate authority (CA), and file-backed secret path resolves inside the
  container
- the configured backend is reachable from the container network; container
  loopback refers to the Impulse container itself
- mounted files are readable by UID `10001`, unless you deliberately override
  the image user

The packaged development configuration expects certificate filenames from the
repository `certs/` directory. Replace those files and paths for real use.

## Run One Container

From the repository root, the packaged development inputs run as:

```bash
docker run --rm \
  --name impulse \
  -p 9889:9889/udp \
  -p 9889:9889/tcp \
  -v "$(pwd)/packaging/docker/config.docker.yaml:/etc/impulse/config.yaml:ro" \
  -v "$(pwd)/certs:/etc/impulse/certs:ro" \
  impulse:packaging
```

Publishing both protocols is intentional: UDP serves the native QUIC listener,
while TCP serves the bootstrap HTTP/1.1 and HTTP/2 listener on the same port.
The packaged configuration disables the optional metrics and Control API
listeners, so ports `9901` and `9902` are not published.

The placeholder backend in `config.docker.yaml` is container-local. Startup can
succeed without it, but proxied traffic cannot. Point it at a service on the
same Docker network or another address reachable from the container before
testing traffic.

## Run with Compose

The repository Compose file builds the same image, mounts the same packaged
configuration and certificates, and publishes only the proxy listener:

```bash
docker compose -f packaging/docker/docker-compose.yml up -d --build
docker compose -f packaging/docker/docker-compose.yml logs -f impulse
```

Stop it with:

```bash
docker compose -f packaging/docker/docker-compose.yml down
```

The Compose service overrides the runtime user to root. Review that
choice before production; the image itself defaults to UID `10001`.

## Production Boundaries

- Pin an official image by version or digest when registry publication exists;
  do not deploy a floating tag.
- Keep configuration, certificates, keys, and secret files in read-only mounts.
- Do not expose metrics or the Control API merely by publishing their ports.
  Configure their bind addresses, TLS, authentication, and network boundary as
  described in
  [Observability and Control Configuration](/docs/configuration/observability-and-control).
- Send container logs to stdout/stderr unless your platform has a deliberate
  file-volume and rotation policy.
- Use [Production Deployment](/docs/deployment/production) before serving real
  traffic.

## Related Pages

- [Quickstart](/docs/getting-started/quickstart)
- [Installation](/docs/getting-started/installation)
- [Configuration Examples](/docs/configuration/examples)
- [Production Deployment](/docs/deployment/production)
