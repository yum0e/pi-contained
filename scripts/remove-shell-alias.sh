#!/usr/bin/env bash
set -euo pipefail

if [[ "${SHELL:-}" == *"zsh"* ]]; then
  rc_file="$HOME/.zshrc"
else
  rc_file="$HOME/.bashrc"
fi

[[ -f "$rc_file" ]] || {
  echo "Nothing to remove ($rc_file does not exist)."
  exit 0
}

marker_start="# >>> pi-devcontainer >>>"
marker_end="# <<< pi-devcontainer <<<"

tmp_file="$(mktemp)"
awk -v start="$marker_start" -v end="$marker_end" '
  $0 == start { skip=1; next }
  $0 == end { skip=0; next }
  !skip { print }
' "$rc_file" > "$tmp_file"

mv "$tmp_file" "$rc_file"

echo "Removed pi alias block from $rc_file"
echo "Run: source $rc_file"
