# Deployment

## Frontend

Build the frontend:

```bash
npm run build
```

The project publishes `dist/` to GitHub Pages through the `gh-pages` package. After configuring the repository's Pages source and Git credentials, publish with:

```bash
npm run deploy
```

The `predeploy` script runs the production build before publishing.

## Backend

Deploy the Cloudflare Worker:

```bash
cd backend
npm run deploy
```
