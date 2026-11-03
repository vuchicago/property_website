#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# -gt 1 || ($# -eq 1 && "$1" != "--browser") ]]; then
  echo 'Usage: bash scripts/test.sh [--browser]' >&2
  exit 2
fi
node --test tests/*.test.mjs
python3 tests/packet-schema.test.py
while IFS= read -r source; do
  node --check "$source"
done < <(rg --files -g '*.js' -g '!assets/**' -g '!ai-sales/**')
bash build.sh
git diff --check
if [[ "${1:-}" == '--browser' ]]; then
  node --test tests/browser-regression.cjs
fi
