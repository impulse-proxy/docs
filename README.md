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

The Docusaurus configuration targets the `gh-pages` deployment branch at
<https://impulse-proxy.github.io/docs/>. This repository does not currently
contain a GitHub Actions deployment workflow, so pushing to `main` does not by
itself publish the site. For manual Docusaurus deployment, configure Pages to
deploy from the root of the `gh-pages` branch. Select **GitHub Actions** as the
Pages source only after an Actions deployment workflow has been added.
