#!/usr/bin/env python3
"""Extract tax-code composite rates from an official Clerk tax-code PDF.

This helper requires `pdfplumber`:

    python3 -m pip install pdfplumber

The output is a CSV suitable for `export_property_tax_rates_sql.py`.

Important: the Clerk's annual "Tax Rate Report" PDF contains narrative,
municipality averages, and agency rates. It does not appear to contain a
property tax-code-level table. This helper is meant for a "Tax Code Rate
Summary" style PDF with rows like:

    10001 5.302000
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


RATE_ROW = re.compile(r"^\s*(\d{5})\s+(\d{1,3}(?:\.\d{3})?)\s*$")


def extract_rows(pdf_path: Path, tax_year: int) -> list[tuple[int, str, str]]:
    try:
        import pdfplumber
    except ImportError as exc:
        raise SystemExit(
            "pdfplumber is required to extract the Clerk PDF. Install it with:\n"
            "python3 -m pip install pdfplumber"
        ) from exc

    rows: dict[str, str] = {}
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            for line in text.splitlines():
                match = RATE_ROW.match(line)
                if not match:
                    continue
                tax_code, rate = match.groups()
                rows[tax_code] = rate

    return [(tax_year, tax_code, rate) for tax_code, rate in sorted(rows.items())]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Official Clerk tax-rate PDF.")
    parser.add_argument("--output", required=True, help="CSV output path.")
    parser.add_argument("--tax-year", type=int, required=True)
    args = parser.parse_args()

    rows = extract_rows(Path(args.input), args.tax_year)
    if not rows:
        raise SystemExit(
            "No tax-code rows were extracted. This PDF may be the annual Tax Rate Report, "
            "which has municipality-average rates, not tax-code-level rows. Use an official "
            "Tax Code Rate Summary PDF/CSV or a CSV with tax_year,tax_code,tax_code_rate."
        )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["tax_year", "tax_code", "tax_code_rate"])
        writer.writerows(rows)

    print(f"Wrote {len(rows):,} tax-code rates to {output}")


if __name__ == "__main__":
    main()
