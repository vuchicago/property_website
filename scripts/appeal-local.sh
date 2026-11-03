#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="free"
if [[ "${1:-}" == "--payments" ]]; then mode="payments"; elif [[ $# -gt 0 ]]; then echo 'Usage: ./scripts/appeal-local.sh [--payments]' >&2; exit 2; fi
state_dir="$PWD/.wrangler/appeal-pilot"
mkdir -p "$state_dir"
if [[ ! -f "$state_dir/.initialized" ]]; then
  echo 'Initializing isolated local D1 and R2 state. No remote database is used.'
  for file in schema.sql migrations/0029_create_appeal_packets.sql migrations/0030_create_self_appeal_cases.sql migrations/0031_create_packet_fulfillment.sql migrations/0032_create_appeal_pilot_access.sql scripts/appeal-local-seed.sql; do
    npx --no-install wrangler d1 execute appeal_db --local --persist-to "$state_dir" --file "$file" --yes
  done
  touch "$state_dir/.initialized"
fi
bash build.sh
# An isolated project configuration omits the remote AI binding and all secrets.
local_project="$state_dir/project-$mode"
mkdir -p "$local_project"
ready="0"
if [[ "$mode" == "payments" ]]; then
  secrets_file="$local_project/.dev.vars"
  if [[ ! -f "$secrets_file" ]]; then echo "Create $secrets_file with Stripe test and DocuSign demo credentials first." >&2; exit 2; fi
  for key in STRIPE_TEST_SECRET_KEY STRIPE_TEST_WEBHOOK_SECRET DOCUSIGN_INTEGRATION_KEY DOCUSIGN_USER_ID DOCUSIGN_ACCOUNT_ID DOCUSIGN_PRIVATE_KEY; do
    if ! rg -q "^${key}=" "$secrets_file"; then echo "Missing $key in local payment test credentials." >&2; exit 2; fi
  done
  if rg -q 'sk_live_|pk_live_|^STRIPE_MODE=live$|^DOCUSIGN_ENV=production$' "$secrets_file"; then echo 'Live provider credentials are not permitted in local payment mode.' >&2; exit 2; fi
  ready="1"
fi
mkdir -p "$local_project"
for item in dist functions assets packet-requirements.js; do
  if [[ ! -e "$local_project/$item" ]]; then ln -s "$PWD/$item" "$local_project/$item"; fi
done
cat > "$local_project/wrangler.jsonc" <<JSON
{
  "name": "cookcountytaxcompare-local-pilot",
  "compatibility_date": "2026-02-01",
  "pages_build_output_dir": "dist",
  "d1_databases": [{"binding":"DB","database_name":"appeal_db","database_id":"ccbba211-1c8b-46b6-94f5-12e1cf840609"}],
  "r2_buckets": [{"binding":"APPEAL_PACKETS","bucket_name":"appeal-pilot-local"}],
  "vars": {"DEPLOYMENT_READY":"$ready","STRIPE_MODE":"test","DOCUSIGN_ENV":"demo"}
}
JSON
cd "$local_project"
npx --no-install wrangler pages dev dist --persist-to "$state_dir" --ip 127.0.0.1 --port 8788
