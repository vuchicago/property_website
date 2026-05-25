#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-appeal_db}"
WRANGLER="${WRANGLER:-npx wrangler@latest}"
FIRST_IMPORT_FILE="import/property_addresses_2025_updated_part_0001.sql"

if [ ! -f "$FIRST_IMPORT_FILE" ]; then
        echo "Missing $FIRST_IMPORT_FILE. Regenerate the import files before pushing."
        exit 1
fi

if ! sed -n '2p' "$FIRST_IMPORT_FILE" | grep -q "city, zip_code"; then
        echo "$FIRST_IMPORT_FILE does not include city/zip_code columns. Regenerate it from the current parquet before pushing."
        exit 1
fi

if ! sed -n '2p' "$FIRST_IMPORT_FILE" | grep -q "township_name, township_code"; then
        echo "$FIRST_IMPORT_FILE does not include township columns. Regenerate it from the current parquet before pushing."
        exit 1
fi

$WRANGLER d1 execute "$DB_NAME" --remote --yes --file=migrations/0006_rebuild_property_addresses_full.sql
IMPORT_STEM=property_addresses_2025_updated DB_NAME="$DB_NAME" WRANGLER="$WRANGLER" bash scripts/import_property_addresses_parts.sh
$WRANGLER d1 execute "$DB_NAME" --remote --yes --file=migrations/0007_add_property_addresses_pin_index.sql
$WRANGLER d1 execute "$DB_NAME" --remote --yes --file=migrations/0009_add_property_compare_indexes.sql
$WRANGLER d1 execute "$DB_NAME" --remote --command="SELECT COUNT(*) AS count FROM property_addresses;"
