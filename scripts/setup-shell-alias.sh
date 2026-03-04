#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "$script_dir/.." && pwd -P)"

if [[ "${SHELL:-}" == *"zsh"* ]]; then
  rc_file="$HOME/.zshrc"
else
  rc_file="$HOME/.bashrc"
fi

marker_start="# >>> pi-devcontainer >>>"
marker_end="# <<< pi-devcontainer <<<"

if [[ -n "${PI_DEVCONTAINER_ALIAS_TARGET:-}" ]]; then
  alias_target="$PI_DEVCONTAINER_ALIAS_TARGET"
elif command -v pi-devcontainer >/dev/null 2>&1; then
  alias_target="pi-devcontainer"
else
  alias_target="$repo_root/bin/pi-devcontainer"
fi

alias_line="alias pi='$alias_target'"

mkdir -p "$(dirname "$rc_file")"
touch "$rc_file"

tmp_file="$(mktemp)"
awk -v start="$marker_start" -v end="$marker_end" '
  $0 == start { skip=1; next }
  $0 == end { skip=0; next }
  !skip { print }
' "$rc_file" > "$tmp_file"

{
  cat "$tmp_file"
  echo "$marker_start"
  echo "$alias_line"
  echo "$marker_end"
} > "$rc_file"

rm -f "$tmp_file"

echo "Added pi alias to $rc_file"
echo "Run: source $rc_file"
