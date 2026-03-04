#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "$script_dir/.." && pwd -P)"

target_repo="${1:-$(pwd -P)}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Install Docker Desktop first." >&2
  exit 1
fi

if ! command -v devcontainer >/dev/null 2>&1; then
  echo "devcontainer CLI not found. Install with: npm install -g @devcontainers/cli" >&2
  exit 1
fi

"$repo_root/bin/pi-devcontainer-template" setup "$target_repo"
