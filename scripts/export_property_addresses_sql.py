#!/usr/bin/env python3
"""Export Cook County property address Parquet rows into D1-friendly SQL."""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

import pyarrow.parquet as pq


PROPERTY_COLUMNS = [
    "pin",
    "address",
    "normalized_address",
    "taxable_value",
    "last_appeal_year",
    "certified_land",
    "certified_building",
    "home_size",
    "year_built",
    "last_appeal_status",
    "bedroom_count",
    "bathroom_count",
    "masonry_type",
    "finished_basement",
    "repair_condition",
    "single_vs_multi_family",
    "neighborhood_code",
    "garage_size",
    "property_class",
    "pin_proration_rate",
    "pin10",
    "latitude",
    "longitude",
    "class_code",
    "tax_district_code",
    "municipality_number",
    "municipality_name",
    "tax_municipality_name",
    "cmap_walkability_total_score",
    "cmap_walkability_no_transit_score",
    "flood_fs_factor",
    "chicago_community_area",
    "condo_unit_sqft",
    "condo_building_sqft",
    "condo_building_non_units",
    "condo_building_pins",
    "condo_building_mixed_use",
    "condo_parking_space",
    "condo_common_area",
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


def clean_number(value, integer: bool = False):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if clean_string(value) is None:
        return None
    return int(value) if integer else float(value)


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
        clean_number(row.get("Taxable Value"), integer=True),
        clean_string(row.get("Last Appeal Year")),
        clean_number(row.get("Certified Land"), integer=True),
        clean_number(row.get("Certified Building"), integer=True),
        clean_number(row.get("Home Size")),
        clean_number(row.get("Year Built")),
        clean_string(row.get("Last Appeal Status")),
        clean_number(row.get("Bedroom Count")),
        clean_number(row.get("Bathroom Count")),
        clean_string(row.get("Masonry Type")),
        clean_string(row.get("Finished Basement")),
        clean_string(row.get("Repair Condition")),
        clean_string(row.get("Single vs Multi Family")),
        clean_string(row.get("Neighborhood Code")),
        clean_string(row.get("Garage Size")),
        clean_string(row.get("Class Description")),
        clean_number(row.get("PIN Proration Rate")),
        clean_pin(row.get("pin10")),
        clean_number(row.get("lat")),
        clean_number(row.get("lon")),
        clean_string(row.get("class")),
        clean_number(row.get("Tax District Code"), integer=True),
        clean_number(row.get("Municipality Number"), integer=True),
        clean_string(row.get("Municipality Name")),
        clean_string(row.get("Tax Municipality Name")),
        clean_number(row.get("CMAP Walkability Total Score")),
        clean_number(row.get("CMAP Walkability No Transit Score")),
        clean_number(row.get("Flood FS Factor")),
        clean_string(row.get("Chicago Community Area")),
        clean_number(row.get("Condo Unit Sqft")),
        clean_number(row.get("Condo Building Sqft")),
        clean_number(row.get("Condo Building Non-Units")),
        clean_number(row.get("Condo Building PINs")),
        clean_bool(row.get("Condo Building Mixed Use")),
        clean_bool(row.get("Condo Parking Space")),
        clean_bool(row.get("Condo Common Area")),
    ]


def flush_insert(handle, rows: list[list], columns: list[str]) -> None:
    if not rows:
        return
    handle.write(f"INSERT OR REPLACE INTO property_addresses ({', '.join(columns)}) VALUES\n")
    handle.write(",\n".join("(" + ", ".join(sql_literal(value) for value in row) + ")" for row in rows))
    handle.write(";\n")


def part_path(output_path: Path, part_number: int) -> Path:
    return output_path.with_name(f"{output_path.stem}_part_{part_number:04d}{output_path.suffix}")


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
    parser.add_argument(
        "--rows-per-file",
        type=int,
        default=0,
        help="Split output into multiple SQL files with this many rows each. Use this for large D1 imports.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    parquet_file = pq.ParquetFile(input_path)
    exported = 0
    batch: list[list] = []
    part_number = 1
    rows_in_part = 0

    def open_output_file():
        path = part_path(output_path, part_number) if args.rows_per_file else output_path
        handle = path.open("w", encoding="utf-8")
        if part_number == 1:
            handle.write("DELETE FROM property_addresses;\n")
        return handle, path

    handle, current_path = open_output_file()

    try:
        for record_batch in parquet_file.iter_batches(batch_size=10_000):
            table = record_batch.to_pylist()
            for row in table:
                values = row_to_values(row)
                if not values:
                    continue

                batch.append(values)
                exported += 1
                rows_in_part += 1

                if len(batch) >= args.batch_size:
                    flush_insert(handle, batch, PROPERTY_COLUMNS)
                    batch = []

                if args.rows_per_file and rows_in_part >= args.rows_per_file:
                    flush_insert(handle, batch, PROPERTY_COLUMNS)
                    batch = []
                    handle.close()
                    print(f"Wrote {current_path}")
                    part_number += 1
                    rows_in_part = 0
                    handle, current_path = open_output_file()

        flush_insert(handle, batch, PROPERTY_COLUMNS)
    finally:
        handle.close()

    if args.rows_per_file:
        print(f"Wrote {current_path}")
        print(f"Exported {exported:,} full property address rows across {part_number} files")
    else:
        print(f"Exported {exported:,} full property address rows to {output_path}")


if __name__ == "__main__":
    main()
