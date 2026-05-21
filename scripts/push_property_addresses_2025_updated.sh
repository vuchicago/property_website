#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-appeal_db}"
WRANGLER="${WRANGLER:-npx wrangler@latest}"

$WRANGLER d1 execute "$DB_NAME" --remote --yes --file=migrations/0006_rebuild_property_addresses_full.sql
IMPORT_STEM=property_addresses_2025_updated DB_NAME="$DB_NAME" WRANGLER="$WRANGLER" bash scripts/import_property_addresses_parts.sh
$WRANGLER d1 execute "$DB_NAME" --remote --yes --file=migrations/0007_add_property_addresses_pin_index.sql
$WRANGLER d1 execute "$DB_NAME" --remote --yes --file=migrations/0009_add_property_compare_indexes.sql
$WRANGLER d1 execute "$DB_NAME" --remote --command="SELECT COUNT(*) AS count FROM property_addresses;"
