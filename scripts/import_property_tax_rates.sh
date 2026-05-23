#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-appeal_db}"
SQL_FILE="${SQL_FILE:-import/property_tax_rates.sql}"
WRANGLER="${WRANGLER:-npx wrangler@latest}"

if [ ! -s "$SQL_FILE" ]; then
        echo "Missing or empty SQL file: $SQL_FILE" >&2
        echo "Generate it first with scripts/export_property_tax_rates_sql.py." >&2
        exit 1
fi

if ! grep -q "INSERT OR REPLACE INTO property_tax_rates" "$SQL_FILE"; then
        echo "No property_tax_rates INSERT statements found in $SQL_FILE." >&2
        echo "The source CSV probably did not contain the requested tax year." >&2
        exit 1
fi

echo "Importing $SQL_FILE"
$WRANGLER d1 execute "$DB_NAME" --remote --yes --file="$SQL_FILE"

echo "Tax rate import complete. Verify with:"
echo "$WRANGLER d1 execute $DB_NAME --remote --command=\"SELECT tax_year, COUNT(*) AS tax_codes, MIN(composite_tax_rate) AS min_rate, MAX(composite_tax_rate) AS max_rate FROM property_tax_rates GROUP BY tax_year ORDER BY tax_year DESC;\""
