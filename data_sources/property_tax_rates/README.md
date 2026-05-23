# Cook County Property Tax Rates

This folder stores source files used to populate the D1 `property_tax_rates`
lookup table.

## Current Source Needed

Use an official Cook County Clerk **Tax Code Rate Summary** or another Clerk
source that contains one row per tax code. The site needs tax-code-level rates
because `property_addresses.tax_district_code` maps to a tax code.

The annual 2024 Tax Rate Report PDF is useful for explaining the process and
showing municipality-average rates, but it is not enough for this lookup table:

https://www.cookcountyclerkil.gov/sites/default/files/pdfs/2024-tax-rate-report.pdf

That PDF does not appear to include tax-code-level rows like `10001 -> 5.302`.

The old Cook County Open Data file named
`Cook_County_Clerk_-_Tax_codes__agencies__and_rates.csv` is not current. Its
metadata was updated in 2026, but the actual rows only contain tax years 2006
through 2013, so it should not be used for current tax-year imports.

## Required CSV Format

Create or obtain a CSV with one row per tax code:

```csv
tax_year,tax_code,tax_code_rate
2024,10001,5.302
2024,10002,5.315
```

The export script also accepts Clerk-style headers:

```csv
Tax Year,Tax code,Tax code Rate
```

## Import Flow

From the repo root:

```bash
python3 scripts/export_property_tax_rates_sql.py \
  --input data_sources/property_tax_rates/cook_county_tax_rates_2024.csv \
  --tax-year 2024 \
  --source "Cook County Clerk 2024 Tax Code Rate Summary" \
  --output import/property_tax_rates.sql

bash scripts/import_property_tax_rates.sh
```

Verify:

```bash
npx wrangler d1 execute appeal_db --remote --command="SELECT tax_year, COUNT(*) AS tax_codes, MIN(composite_tax_rate) AS min_rate, MAX(composite_tax_rate) AS max_rate FROM property_tax_rates GROUP BY tax_year;"
```
