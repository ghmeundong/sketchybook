# Developer Guide

This guide covers setting up Sketchybook locally, running its services, and checking changes. For implementation notes about the audio system, see [Development Notes](DEVELOPMENT.md).

## Requirements

- Node.js and npm

## Install

From the project root, install the frontend dependencies:

```bash
npm install
```

If you plan to run the Cloudflare Worker locally, install its dependencies too:

```bash
cd backend
npm install
cd ..
```

## Run locally

Start the frontend only:

```bash
npm run dev
```

Start the frontend and backend together:

```bash
npm run dev:full
```

To run only the backend Worker:

```bash
npm run dev:backend
```

## Check changes

Run the test suite:

```bash
npm test
```

Run ESLint and Stylelint:

```bash
npm run lint
```

Build the web app for production:

```bash
npm run build
```

## Desktop builds

Launch the Electron app locally:

```bash
npm run dev:electron
```

Build the Windows installer:

```bash
npm run build:exe
```

The installer is written to the `release/` directory.
