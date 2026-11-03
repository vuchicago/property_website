#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
run_browser=false
run_worker=false
for option in "$@"; do
  case "$option" in
    --browser) run_browser=true ;;
    --worker) run_worker=true ;;
    *) echo 'Usage: bash scripts/test.sh [--browser] [--worker]' >&2; exit 2 ;;
  esac
done
node --test tests/*.test.mjs
python3 tests/packet-schema.test.py
while IFS= read -r source; do
  node --check "$source"
done < <(rg --files -g '*.js' -g '!assets/**' -g '!ai-sales/**')
bash build.sh
git diff --check
if [[ "$run_worker" == true ]]; then
  npx --no-install wrangler pages functions build functions --outdir /tmp/cookcounty-regression-worker
  node --test tests/appeal-worker.integration.cjs
fi
if [[ "$run_browser" == true ]]; then
  node --test tests/browser-regression.cjs
fi
