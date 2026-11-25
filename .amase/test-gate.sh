#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "[+] Running AMASE Test Gate (Node)..."

if command -v bun >/dev/null 2>&1; then
  if grep -q '"test"[[:space:]]*:' package.json 2>/dev/null; then
    bun run test
  else
    bun test
  fi
else
  npm test
fi

# Optional UI Fast-Gate
UI_TARGET="${AMASE_UI_URL:-}"
if [[ -z "$UI_TARGET" && -f ".amase/config.json" ]]; then
  UI_TARGET=$(jq -r '.ui.target_url // empty' ".amase/config.json" 2>/dev/null || true)
fi
if [[ -n "$UI_TARGET" ]] && command -v amase >/dev/null 2>&1; then
  echo "[+] Running AMASE UI Fast-Gate on $UI_TARGET..."
  amase ui-check "$UI_TARGET"
fi
