# Impulse Documentation

The Docusaurus website for the [Impulse](https://github.com/impulse-proxy/impulse) documentation.

## Installation

```bash
npm install
```

## Local Development

```bash
npm run start
```

This starts the local development server with live reload.

The documentation is available at `http://localhost:3000/docs/`.

The production site is published at <https://impulse-proxy.github.io/docs/>.

## Build

```bash
npm run build
```

This generates the production site in the `build` directory.

## Deployment

Pushes to `main` are deployed to GitHub Pages by the workflow in
`.github/workflows/deploy.yml`. In the repository's **Settings → Pages**, set
the source to **GitHub Actions**.
