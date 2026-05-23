#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-appeal_db}"
SQL_FILE="${SQL_FILE:-import/property_tax_exemptions.sql}"
WRANGLER="${WRANGLER:-npx wrangler@latest}"

echo "Importing $SQL_FILE"
$WRANGLER d1 execute "$DB_NAME" --remote --yes --file="$SQL_FILE"

echo "Exemption import complete. Verify with:"
echo "$WRANGLER d1 execute $DB_NAME --remote --command=\"SELECT tax_year, exemption_type, COUNT(*) AS pins FROM property_tax_exemptions GROUP BY tax_year, exemption_type ORDER BY tax_year DESC, exemption_type;\""
