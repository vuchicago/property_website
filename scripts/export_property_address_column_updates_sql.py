#!/usr/bin/env python3
"""Export D1 UPDATE files for property_addresses columns added after initial import."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import pyarrow.parquet as pq


UPDATE_COLUMNS = {
    "city": "City",
    "zip_code": "Zip Code",
    "mailing_name": "Mailing Name",
    "mailing_address": "Mailing Address",
    "township_name": "Township Name",
    "township_code": "Township Code",
}


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
    number = float(value)
    if math.isnan(number):
        return None
    return int(number) if integer else number


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def part_path(output_path: Path, part_number: int) -> Path:
    return output_path.with_name(f"{output_path.stem}_part_{part_number:04d}{output_path.suffix}")


def row_to_update(row: dict) -> str | None:
    pin = clean_pin(row.get("pin"))
    if not pin:
        return None

    values = {
        "city": clean_string(row.get("City")),
        "zip_code": clean_number(row.get("Zip Code"), integer=True),
        "mailing_name": clean_string(row.get("Mailing Name")),
        "mailing_address": clean_string(row.get("Mailing Address")),
        "township_name": clean_string(row.get("Township Name")),
        "township_code": clean_string(row.get("Township Code")),
    }

    assignments = ", ".join(f"{column} = {sql_literal(value)}" for column, value in values.items())
    return f"UPDATE property_addresses SET {assignments} WHERE pin = {sql_literal(pin)};"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="../property_tax_data_big/output_all_2025.parquet",
        help="Path to the Cook County Parquet file.",
    )
    parser.add_argument(
        "--output",
        default="import/property_addresses_2025_column_updates.sql",
        help="SQL file stem to create.",
    )
    parser.add_argument(
        "--rows-per-file",
        type=int,
        default=10_000,
        help="Rows per SQL part file. Values below 10000 are raised to 10000.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Stop after this many exported update statements.")
    args = parser.parse_args()
    if args.rows_per_file < 10_000:
        print(f"rows-per-file {args.rows_per_file:,} is too small; using 10,000 instead.")
        args.rows_per_file = 10_000

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    parquet_file = pq.ParquetFile(args.input)
    part_number = 1
    rows_in_part = 0
    exported = 0

    current_path = part_path(output_path, part_number)
    handle = current_path.open("w", encoding="utf-8")
    stop = False

    try:
        for record_batch in parquet_file.iter_batches(batch_size=10_000):
            for row in record_batch.to_pylist():
                statement = row_to_update(row)
                if not statement:
                    continue

                handle.write(statement)
                handle.write("\n")
                rows_in_part += 1
                exported += 1

                if args.limit and exported >= args.limit:
                    stop = True
                    break

                if rows_in_part >= args.rows_per_file:
                    handle.close()
                    print(f"Wrote {current_path}")
                    part_number += 1
                    rows_in_part = 0
                    current_path = part_path(output_path, part_number)
                    handle = current_path.open("w", encoding="utf-8")
            if stop:
                break
    finally:
        handle.close()

    print(f"Wrote {current_path}")
    print(f"Exported {exported:,} update statements across {part_number} files")


if __name__ == "__main__":
    main()
