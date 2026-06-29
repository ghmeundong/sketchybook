# Template Project

This template includes a Vite-based frontend, optional Cloudflare Workers backend, and tooling for linting and formatting.

## Features

- Vite project structure
- ESLint + Prettier + Stylelint
- Husky + lint-staged
- Optional `backend/` folder for Cloudflare Workers
- Static asset folder `public/`

## Backend

```bash
cd backend
npm install
npm run dev
```

## frontend

```bash
npm install
npm run dev
```

## api check (browser console)

```bash
fetch('/api/health').then(r=>r.json()).then(j=>console.log('API:', j)).catch(e=>console.error('API error:', e));
```

## linting and Formatting

```bash
npm run lint
```

## To automatically fix formatting and style issues, run:

```bash
npm run lint -- --fix
# or use prettier directly
npx prettier --write .
```

## .husky example
edit the hook files directly under `.husky`.

Example `.husky/pre-commit`:

```sh
npx prettier --write .
```

Example `.husky/pre-push`:

```sh
npm run lint
```

## (optional) node version check for github actions

```bash
nvm use
```
