#!/usr/bin/env python3
"""Export Cook County Clerk tax-code rates into D1-friendly SQL.

The preferred source is a CSV with columns like:
tax_year, tax_code, tax_code_rate

The current source should be an extracted CSV from the official Cook County
Clerk Tax Rate Report PDF. Do not use the old Cook County Open Data Socrata
tax-rate dataset for current years; its metadata is updated, but the rows only
run through 2013.
"""

from __future__ import annotations

import argparse
import csv
import io
import re
from pathlib import Path


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def clean_text(value) -> str | None:
    text = str(value or "").strip()
    return text or None


def clean_tax_code(value) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    try:
        return str(int(float(text)))
    except ValueError:
        return re.sub(r"\D+", "", text) or text


def clean_number(value) -> float | None:
    text = clean_text(value)
    if not text:
        return None
    text = text.replace("%", "").replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def find_column(fieldnames: list[str], aliases: set[str]) -> str | None:
    normalized = {normalize_header(field): field for field in fieldnames}
    for alias in aliases:
        if alias in normalized:
            return normalized[alias]
    return None


def export_rates(args) -> int:
    raw_csv = Path(args.input).read_text(encoding="utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw_csv))
    fieldnames = reader.fieldnames or []

    tax_year_column = find_column(fieldnames, {"tax_year", "year"})
    tax_code_column = find_column(fieldnames, {"tax_code", "taxcode", "tax_district_code", "tax_district"})
    rate_column = find_column(fieldnames, {"tax_code_rate", "composite_tax_rate", "tax_rate", "rate"})

    if not tax_code_column or not rate_column:
        raise SystemExit(
            "Could not find required columns. Expected tax_code and tax_code_rate "
            "or equivalent column names."
        )

    rates: dict[tuple[int, str], float] = {}
    available_years: set[int] = set()
    for row in reader:
        tax_year = int(clean_number(row.get(tax_year_column)) or args.tax_year)
        available_years.add(tax_year)
        if args.tax_year and tax_year != args.tax_year:
            continue

        tax_code = clean_tax_code(row.get(tax_code_column))
        rate = clean_number(row.get(rate_column))
        if not tax_code or rate is None:
            continue

        rates[(tax_year, tax_code)] = rate

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    source = args.source or args.input

    if not rates:
        years = ", ".join(str(year) for year in sorted(available_years)) or "none detected"
        raise SystemExit(
            f"No tax-code rates found for tax year {args.tax_year}. "
            f"Available years in {args.input}: {years}."
        )

    with output.open("w", encoding="utf-8") as handle:
        handle.write(
            "CREATE TABLE IF NOT EXISTS property_tax_rates ("
            "tax_year INTEGER NOT NULL, "
            "tax_district_code TEXT NOT NULL, "
            "composite_tax_rate REAL NOT NULL, "
            "source TEXT, "
            "imported_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "PRIMARY KEY (tax_year, tax_district_code)"
            ");\n"
        )
        for (tax_year, tax_code), rate in sorted(rates.items()):
            handle.write(
                "INSERT OR REPLACE INTO property_tax_rates "
                "(tax_year, tax_district_code, composite_tax_rate, source) VALUES "
                f"({tax_year}, {sql_literal(tax_code)}, {rate}, {sql_literal(source)});\n"
            )

    print(f"Wrote {len(rates):,} tax-code rates to {output}")
    return len(rates)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="CSV file path extracted from the official Clerk Tax Rate Report.")
    parser.add_argument("--output", default="import/property_tax_rates.sql", help="SQL output path.")
    parser.add_argument("--tax-year", type=int, required=True, help="Tax year to export.")
    parser.add_argument("--source", default="", help="Source label/URL to store with each row.")
    args = parser.parse_args()
    export_rates(args)


if __name__ == "__main__":
    main()
