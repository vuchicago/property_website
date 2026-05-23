#!/usr/bin/env python3
"""Export PIN-level exemption history into D1-friendly SQL.

Expected CSV columns:
pin, tax_year, exemption_type, exemption_amount_eav

This is intentionally source-agnostic because homeowner/senior exemption
history is exposed through Cook County property detail/exemption-history tools,
not the Clerk tax-rate dataset.
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import urllib.request
from pathlib import Path


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def clean_text(value) -> str | None:
    text = str(value or "").strip()
    return text or None


def clean_pin(value) -> str | None:
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
    text = text.replace("$", "").replace(",", "")
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


def read_text(path_or_url: str) -> str:
    if path_or_url.startswith(("http://", "https://")):
        with urllib.request.urlopen(path_or_url, timeout=120) as response:
            return response.read().decode("utf-8-sig")
    return Path(path_or_url).read_text(encoding="utf-8-sig")


def find_column(fieldnames: list[str], aliases: set[str]) -> str | None:
    normalized = {normalize_header(field): field for field in fieldnames}
    for alias in aliases:
        if alias in normalized:
            return normalized[alias]
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="CSV file path or URL.")
    parser.add_argument("--output", default="import/property_tax_exemptions.sql", help="SQL output path.")
    parser.add_argument("--tax-year", type=int, default=0, help="Optional tax year filter/default.")
    parser.add_argument("--source", default="", help="Source label/URL to store with each row.")
    args = parser.parse_args()

    raw_csv = read_text(args.input)
    reader = csv.DictReader(io.StringIO(raw_csv))
    fieldnames = reader.fieldnames or []

    pin_column = find_column(fieldnames, {"pin", "property_index_number"})
    tax_year_column = find_column(fieldnames, {"tax_year", "year"})
    type_column = find_column(fieldnames, {"exemption_type", "exemption", "type", "exemption_name"})
    amount_column = find_column(fieldnames, {"exemption_amount_eav", "amount_eav", "eav_amount", "amount"})

    if not pin_column or not type_column:
        raise SystemExit("Could not find required columns. Expected pin and exemption_type or equivalent names.")

    rows = []
    for row in reader:
        pin = clean_pin(row.get(pin_column))
        tax_year = int(clean_number(row.get(tax_year_column)) or args.tax_year or 0)
        exemption_type = clean_text(row.get(type_column))
        amount = clean_number(row.get(amount_column)) if amount_column else None
        if not pin or not tax_year or not exemption_type:
            continue
        rows.append((tax_year, pin, exemption_type, amount))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    source = args.source or args.input

    with output.open("w", encoding="utf-8") as handle:
        handle.write(
            "CREATE TABLE IF NOT EXISTS property_tax_exemptions ("
            "tax_year INTEGER NOT NULL, "
            "pin TEXT NOT NULL, "
            "exemption_type TEXT NOT NULL, "
            "exemption_amount_eav REAL, "
            "source TEXT, "
            "imported_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "PRIMARY KEY (tax_year, pin, exemption_type)"
            ");\n"
        )
        for tax_year, pin, exemption_type, amount in rows:
            handle.write(
                "INSERT OR REPLACE INTO property_tax_exemptions "
                "(tax_year, pin, exemption_type, exemption_amount_eav, source) VALUES "
                f"({tax_year}, {sql_literal(pin)}, {sql_literal(exemption_type)}, "
                f"{sql_literal(amount)}, {sql_literal(source)});\n"
            )

    print(f"Wrote {len(rows):,} exemption rows to {output}")


if __name__ == "__main__":
    main()
