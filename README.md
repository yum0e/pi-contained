# pi-devcontainer-extension

Minimal **pi extension + wrapper** to always run `pi` in a devcontainer.

## What this gives you

- `pi` runs inside a container every time (when aliased through this wrapper)
- Host filesystem exposure is limited to:
  - current workspace
  - `~/.pi` (for auth/session persistence)
- Fail-closed startup check: if pi is launched outside a container, it exits
- No host env vars are explicitly forwarded
- Node is pinned to **24.14.0**
- **corepack + pnpm** are enabled in the container
- `jj` (Jujutsu) is preinstalled in the container (prebuilt release binary)

## Why Docker is still required

`@devcontainers/cli` is just the orchestrator. On macOS it still needs a container runtime, typically **Docker Desktop**.

## Prerequisites (macOS)

- Docker Desktop
- Dev Containers CLI

```bash
npm install -g @devcontainers/cli
```

## Quick start (automatic bootstrap via extension)

> This package is not published to npm yet.

1) Install once from local path (after cloning/downloading this repo):

```bash
pi install /path/to/pi-contained
```

2) Inside any repo you want to protect, run `pi` once on host.

The extension auto-bootstraps:

- `.devcontainer/devcontainer.json`
- `.devcontainer/Dockerfile`
- `.pi/extensions/require-devcontainer.ts`
- `alias pi='...'` in your shell rc

Then it exits with a `[pi-devcontainer-bootstrap] ...` line.

3) Source your rc and run `pi` again:

```bash
source ~/.zshrc   # or ~/.bashrc
pi
```

After that, every `pi` launch goes through the wrapper:

1. `devcontainer up`
2. `devcontainer exec ... pi`

## One-command manual setup (still available)

```bash
/path/to/pi-contained/bin/pi-devcontainer-extension setup .
source ~/.zshrc   # or ~/.bashrc
pi
```

## Project structure

- `.devcontainer/` - hardened devcontainer config + image
- `bin/pi-devcontainer` - host wrapper that re-execs pi inside container
- `bin/pi-devcontainer-template` - template installer/bootstrap helper
- `bin/pi-devcontainer-extension` - user-friendly entrypoint (`setup`, `install`, `run`)
- `extensions/require-devcontainer.ts` - host auto-bootstrap + fail-closed startup guard (installed to `.pi/extensions/`)

## Notes

- If you launch from a subdirectory, the wrapper mounts the git root and starts pi in the same relative folder inside `/workspace`.
- If `.devcontainer/devcontainer.json` is missing in the workspace, the wrapper exits with an error.
- This significantly reduces host-risk from prompt injection, but is not a cryptographic guarantee against all attacks.

## Publishable package bits

This repo is already structured as an npm package with:

- `bin` entry (`pi-devcontainer`)
- `pi` manifest (`extensions`)
- `keywords: ["pi-package"]`

It is ready to publish once you pick your final package name/version.
