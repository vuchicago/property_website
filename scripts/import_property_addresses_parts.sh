#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-appeal_db}"
IMPORT_STEM="${IMPORT_STEM:-property_addresses_2025}"
START_PART="${START_PART:-1}"
END_PART="${END_PART:-9999}"
WRANGLER="${WRANGLER:-npx wrangler@latest}"

for file in import/"$IMPORT_STEM"_part_*.sql; do
        [ -e "$file" ] || continue
        name="$(basename "$file")"
        part="${name#${IMPORT_STEM}_part_}"
        part="${part%.sql}"
        part_number="$((10#$part))"

        if [ "$part_number" -lt "$START_PART" ] || [ "$part_number" -gt "$END_PART" ]; then
                continue
        fi

        echo "Importing $file"
        $WRANGLER d1 execute "$DB_NAME" --remote --yes --file="$file"
done

echo "Import complete. Verify with:"
echo "$WRANGLER d1 execute $DB_NAME --remote --command=\"SELECT COUNT(*) AS count FROM property_addresses;\""
