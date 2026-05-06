#!/usr/bin/env python3
"""Export Cook County property address Parquet rows into D1-friendly SQL."""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

import pyarrow.parquet as pq


LOOKUP_COLUMNS = [
    "pin",
    "address",
    "normalized_address",
]


def normalize_address(address: str) -> str:
    value = re.sub(r"[^A-Z0-9]+", " ", address.upper()).strip()
    return re.sub(r"\s+", " ", value)


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


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def row_to_values(row: dict) -> list:
    address = clean_string(row.get("Nearby Address"))
    if not address or normalize_address(address) == "NO MATCHES IN RADIUS":
        return []

    return [
        clean_pin(row.get("pin")),
        address,
        normalize_address(address),
    ]


def flush_insert(handle, rows: list[list], columns: list[str]) -> None:
    if not rows:
        return
    handle.write(f"INSERT OR REPLACE INTO property_addresses ({', '.join(columns)}) VALUES\n")
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
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    parquet_file = pq.ParquetFile(input_path)
    exported = 0
    batch: list[list] = []

    with output_path.open("w", encoding="utf-8") as handle:
        handle.write("DELETE FROM property_addresses;\n")

        for record_batch in parquet_file.iter_batches(batch_size=10_000):
            table = record_batch.to_pylist()
            for row in table:
                values = row_to_values(row)
                if not values:
                    continue

                batch.append(values)
                exported += 1

                if len(batch) >= args.batch_size:
                    flush_insert(handle, batch, LOOKUP_COLUMNS)
                    batch = []

        flush_insert(handle, batch, LOOKUP_COLUMNS)

    print(f"Exported {exported:,} address lookup rows to {output_path}")


if __name__ == "__main__":
    main()
