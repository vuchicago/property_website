#!/usr/bin/env python3
"""Export Cook County parcel sales Parquet rows into D1-friendly SQL."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import pandas as pd


PROPERTY_SALES_COLUMNS = [
    "row_id",
    "pin",
    "pin10",
    "sale_year",
    "township_code",
    "neighborhood_code",
    "class_code",
    "sale_date",
    "sale_price",
    "sale_document_num",
    "sale_deed_type",
    "mydec_deed_type",
    "sale_seller_name",
    "is_multisale",
    "num_parcels_sale",
    "sale_buyer_name",
    "sale_type",
    "sale_filter_same_sale_within_365",
    "sale_filter_less_than_10k",
    "sale_filter_deed_type",
]


def clean_string(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null", "<na>", "nat"}:
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
    if isinstance(value, str):
        value = value.replace("$", "").replace(",", "").strip()
    number = float(value)
    if math.isnan(number):
        return None
    return int(number) if integer else number


def clean_bool(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, bool):
        return int(value)
    text = clean_string(value)
    if text is None:
        return None
    normalized = text.lower()
    if normalized in {"true", "t", "yes", "y", "1"}:
        return 1
    if normalized in {"false", "f", "no", "n", "0"}:
        return 0
    return None


def clean_date(value) -> str | None:
    if value is None:
        return None
    timestamp = pd.to_datetime(value, errors="coerce")
    if pd.isna(timestamp):
        return None
    return timestamp.strftime("%Y-%m-%d")


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def part_path(output_path: Path, part_number: int) -> Path:
    return output_path.with_name(f"{output_path.stem}_part_{part_number:04d}{output_path.suffix}")


def row_to_values(row: dict) -> list | None:
    pin = clean_pin(row.get("pin"))
    if not pin:
        return None

    sale_date = clean_date(row.get("sale_date"))
    sale_document_num = clean_string(row.get("sale_document_num"))
    source_row_id = clean_string(row.get("row_id"))
    source_index = clean_string(row.get("_source_index"))
    row_id = source_row_id or "|".join(filter(None, [pin, sale_date, sale_document_num, source_index]))

    if not row_id:
        return None

    return [
        row_id,
        pin,
        pin[:10] if len(pin) >= 10 else None,
        clean_number(row.get("year"), integer=True),
        clean_string(row.get("township_code")),
        clean_string(row.get("neighborhood_code")),
        clean_string(row.get("class")),
        sale_date,
        clean_number(row.get("sale_price")),
        sale_document_num,
        clean_string(row.get("sale_deed_type")),
        clean_string(row.get("mydec_deed_type")),
        clean_string(row.get("sale_seller_name")),
        clean_bool(row.get("is_multisale")),
        clean_number(row.get("num_parcels_sale"), integer=True),
        clean_string(row.get("sale_buyer_name")),
        clean_string(row.get("sale_type")),
        clean_bool(row.get("sale_filter_same_sale_within_365")),
        clean_bool(row.get("sale_filter_less_than_10k")),
        clean_bool(row.get("sale_filter_deed_type")),
    ]


def flush_insert(handle, rows: list[list]) -> None:
    if not rows:
        return
    handle.write(f"INSERT OR REPLACE INTO property_sales ({', '.join(PROPERTY_SALES_COLUMNS)}) VALUES\n")
    handle.write(",\n".join("(" + ", ".join(sql_literal(value) for value in row) + ")" for row in rows))
    handle.write(";\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="../property_tax_data_big/parcel_sales_Jan_2023-May_2026.parquet",
        help="Path to the Cook County parcel sales Parquet file.",
    )
    parser.add_argument(
        "--output",
        default="import/property_sales_2023_2026.sql",
        help="SQL file stem to create.",
    )
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--rows-per-file", type=int, default=5000)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if args.rows_per_file:
        for old_part in output_path.parent.glob(f"{output_path.stem}_part_*{output_path.suffix}"):
            old_part.unlink()

    dataframe = pd.read_parquet(input_path).reset_index(names="_source_index")
    exported = 0
    batch: list[list] = []
    part_number = 1
    rows_in_part = 0

    def open_output_file():
        path = part_path(output_path, part_number) if args.rows_per_file else output_path
        handle = path.open("w", encoding="utf-8")
        if part_number == 1:
            handle.write("DELETE FROM property_sales;\n")
        return handle, path

    handle, current_path = open_output_file()

    try:
        for row in dataframe.to_dict("records"):
            values = row_to_values(row)
            if not values:
                continue

            batch.append(values)
            exported += 1
            rows_in_part += 1

            if len(batch) >= args.batch_size:
                flush_insert(handle, batch)
                batch = []

            if args.rows_per_file and rows_in_part >= args.rows_per_file:
                flush_insert(handle, batch)
                batch = []
                handle.close()
                print(f"Wrote {current_path}")
                part_number += 1
                rows_in_part = 0
                handle, current_path = open_output_file()
    finally:
        flush_insert(handle, batch)
        handle.close()

    print(f"Wrote {current_path}")
    print(f"Exported {exported:,} sales rows")


if __name__ == "__main__":
    main()
