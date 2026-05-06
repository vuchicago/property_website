#!/usr/bin/env python3
"""Export Cook County property address Parquet rows into D1-friendly SQL."""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

import pyarrow.parquet as pq


COLUMNS = [
    "source_year",
    "pin",
    "address",
    "normalized_address",
    "city",
    "state",
    "zip",
    "property_class",
    "class_code",
    "taxable_value",
    "certified_land",
    "certified_building",
    "home_size",
    "bedroom_count",
    "bathroom_count",
    "masonry_type",
    "finished_basement",
    "single_vs_multi_family",
    "neighborhood_code",
    "garage_size",
    "pin_proration_rate",
    "last_appeal_year",
    "last_appeal_status",
    "latitude",
    "longitude",
    "source_row_id",
]


def normalize_address(address: str) -> str:
    value = re.sub(r"[^A-Z0-9]+", " ", address.upper()).strip()
    return re.sub(r"\s+", " ", value)


def split_city_zip(address: str) -> tuple[str | None, str | None]:
    parts = [part.strip() for part in address.split(",")]
    if len(parts) < 2:
        return None, None

    city = parts[-2] or None
    tail = parts[-1]
    zip_match = re.search(r"\b(\d{5})(?:-\d{4})?\b", tail)
    return city, zip_match.group(1) if zip_match else None


def clean_string(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    return text


def clean_pin(value) -> str | None:
    text = clean_string(value)
    if text is None:
        return None
    try:
        number = float(text)
    except ValueError:
        return text
    if math.isnan(number):
        return None
    if number.is_integer():
        return str(int(number))
    return text


def clean_number(value, integer: bool = False):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if clean_string(value) is None:
        return None
    return int(value) if integer else float(value)


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def row_to_values(row: dict, source_year: int, source_index: int) -> list:
    address = clean_string(row.get("Nearby Address"))
    if not address:
        return []

    city, zip_code = split_city_zip(address)
    return [
        source_year,
        clean_pin(row.get("pin")),
        address,
        normalize_address(address),
        city,
        "IL",
        zip_code,
        clean_string(row.get("Class Description")),
        clean_string(row.get("class")),
        clean_number(row.get("Taxable Value"), integer=True),
        clean_number(row.get("Certified Land"), integer=True),
        clean_number(row.get("Certified Building"), integer=True),
        clean_number(row.get("Home Size")),
        clean_number(row.get("Bedroom Count")),
        clean_number(row.get("Bathroom Count")),
        clean_string(row.get("Masonry Type")),
        clean_string(row.get("Finished Basement")),
        clean_string(row.get("Single vs Multi Family")),
        clean_string(row.get("Neighborhood Code")),
        clean_string(row.get("Garage Size")),
        clean_number(row.get("PIN Proration Rate")),
        clean_string(row.get("Last Appeal Year")),
        clean_string(row.get("Last Appeal Status")),
        clean_number(row.get("lat")),
        clean_number(row.get("lon")),
        str(source_index),
    ]


def flush_insert(handle, rows: list[list]) -> None:
    if not rows:
        return
    handle.write(f"INSERT OR REPLACE INTO property_addresses ({', '.join(COLUMNS)}) VALUES\n")
    handle.write(",\n".join("(" + ", ".join(sql_literal(value) for value in row) + ")" for row in rows))
    handle.write(";\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="../property_tax_data_big/output_all_2025.parquet",
        help="Path to the Cook County Parquet file.",
    )
    parser.add_argument(
        "--output",
        default="import/property_addresses_2025.sql",
        help="SQL file to create for wrangler d1 execute.",
    )
    parser.add_argument("--source-year", type=int, default=2025)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    parquet_file = pq.ParquetFile(input_path)
    source_index = 0
    exported = 0
    batch: list[list] = []

    with output_path.open("w", encoding="utf-8") as handle:
        handle.write("BEGIN TRANSACTION;\n")
        handle.write("DELETE FROM property_addresses WHERE source_year = %d;\n" % args.source_year)

        for record_batch in parquet_file.iter_batches(batch_size=10_000):
            table = record_batch.to_pylist()
            for row in table:
                values = row_to_values(row, args.source_year, source_index)
                source_index += 1
                if not values:
                    continue

                batch.append(values)
                exported += 1

                if len(batch) >= args.batch_size:
                    flush_insert(handle, batch)
                    batch = []

        flush_insert(handle, batch)
        handle.write("COMMIT;\n")

    print(f"Exported {exported:,} rows to {output_path}")


if __name__ == "__main__":
    main()
