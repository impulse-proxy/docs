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

GitHub Actions publishes the production site to
<https://impulse-proxy.github.io/docs/>.

- Pull requests targeting `main` run a production build without deploying it.
- Pushes to `main` build and deploy the generated `build` directory.
- The deployment workflow can also be started manually from the Actions tab.

One repository setting is required: open **Settings → Pages**, then set
**Build and deployment → Source** to **GitHub Actions**. The workflow uses the
repository's GitHub token and does not require a personal access token or a
`gh-pages` branch.
