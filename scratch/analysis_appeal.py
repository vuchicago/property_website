#%%
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


#%%
PROPERTY_PARQUET = Path("/Users/vuchicago/Python/property_tax/output_all_2025.parquet")
SALES_PARQUET = Path("/Users/vuchicago/Python/vu-web/parcel_sales_Jan_2023-May_2026.parquet")

CONDO_CLASS_CODE = "299"
RESIDENTIAL_ASSESSMENT_LEVEL = 0.10
CONDO_SALE_VALUE_SIGNAL_PERCENT = 0.03
CONDO_SALE_LOOKBACK_START = pd.Timestamp("2023-01-01")


PROPERTY_COLUMNS = [
    "Nearby Address",
    "City",
    "Zip Code",
    "Taxable Value",
    "Class Code",
    "Class Description",
    "pin",
    "pin10",
    "lat",
    "lon",
    "Home Size",
    "Bedroom Count",
    "Bathroom Count",
    "Last Appeal Year",
    "Last Appeal Status",
    "PIN Proration Rate",
    "Condo Unit Sqft",
    "Condo Building PINs",
    "Condo Parking Space",
    "Condo Common Area",
]


#%%
def clean_pin(value) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits.zfill(14) if digits else None


def clean_money(value) -> float:
    if pd.isna(value):
        return np.nan
    if isinstance(value, (int, float, np.integer, np.floating)):
        return float(value)
    cleaned = str(value).replace("$", "").replace(",", "").strip()
    if not cleaned:
        return np.nan
    return float(cleaned)


def value_per_sqft(value, sqft):
    value = pd.to_numeric(value, errors="coerce")
    sqft = pd.to_numeric(sqft, errors="coerce")
    return value / sqft.where(sqft > 0)


def median_or_nan(values: pd.Series) -> float:
    values = values.dropna()
    return float(values.median()) if len(values) else np.nan


def summarize_counts(frame: pd.DataFrame, label: str) -> None:
    print(f"\n{label}")
    print("-" * len(label))
    print(f"rows: {len(frame):,}")
    if "pin" in frame:
        print(f"unique pins: {frame['pin'].nunique():,}")
    if "pin10" in frame:
        print(f"unique buildings / pin10: {frame['pin10'].nunique():,}")


#%%
properties = pd.read_parquet(PROPERTY_PARQUET, columns=PROPERTY_COLUMNS)

properties["pin"] = properties["pin"].map(clean_pin)
properties["pin10"] = properties["pin10"].fillna(properties["pin"].str[:10]).astype("string")
properties["class_code"] = properties["Class Code"].astype("string").str.strip()
properties["taxable_value"] = pd.to_numeric(properties["Taxable Value"], errors="coerce")
properties["unit_sqft"] = pd.to_numeric(properties["Condo Unit Sqft"], errors="coerce")
properties["home_size"] = pd.to_numeric(properties["Home Size"], errors="coerce")
properties["effective_unit_sqft"] = properties["unit_sqft"].where(
    properties["unit_sqft"].gt(0),
    properties["home_size"],
)
properties["building_pin_count"] = pd.to_numeric(properties["Condo Building PINs"], errors="coerce")
properties["assessed_value_per_sqft"] = value_per_sqft(
    properties["taxable_value"],
    properties["effective_unit_sqft"],
)

condos = properties.loc[properties["class_code"] == CONDO_CLASS_CODE].copy()
large_condos = condos.loc[condos["building_pin_count"].fillna(0) > 4].copy()

summarize_counts(properties, "All properties")
summarize_counts(condos, "All condos")
summarize_counts(large_condos, "Large-building condos currently routed through in-building sale logic first")


#%%
sales = pd.read_parquet(SALES_PARQUET)
sales["pin"] = sales["pin"].map(clean_pin)
sales["pin10"] = sales["pin"].str[:10].astype("string")
sales["sale_price"] = sales["sale_price"].map(clean_money)
sales["sale_date"] = pd.to_datetime(sales["sale_date"], errors="coerce")
sales["num_parcels_sale"] = pd.to_numeric(sales["num_parcels_sale"], errors="coerce").fillna(1)

sales = sales.loc[
    sales["sale_date"].ge(CONDO_SALE_LOOKBACK_START)
    & sales["sale_price"].ge(10_000)
    & sales["num_parcels_sale"].eq(1)
].copy()

sale_units = sales.merge(
    condos[
        [
            "pin",
            "pin10",
            "Nearby Address",
            "taxable_value",
            "effective_unit_sqft",
            "assessed_value_per_sqft",
        ]
    ].rename(columns={"pin10": "property_pin10"}),
    on="pin",
    how="left",
)

sale_units["assessed_equivalent_value"] = sale_units["sale_price"] * RESIDENTIAL_ASSESSMENT_LEVEL
sale_units["assessed_equivalent_per_sqft"] = value_per_sqft(
    sale_units["assessed_equivalent_value"],
    sale_units["effective_unit_sqft"],
)
sale_units["assessment_to_sale_equivalent_ratio"] = (
    sale_units["taxable_value"] / sale_units["assessed_equivalent_value"]
)

condo_sale_units = sale_units.loc[sale_units["property_pin10"].notna()].copy()

summarize_counts(sales, "All recent single-parcel sales")
summarize_counts(condo_sale_units, "Recent condo unit sales that matched a 2025 condo PIN")


#%%
sale_stats = (
    condo_sale_units.groupby("pin10")
    .agg(
        sale_count=("pin", "size"),
        valid_per_sqft_sale_count=("assessed_equivalent_per_sqft", lambda s: s.notna().sum()),
        median_assessed_equivalent_per_sqft=("assessed_equivalent_per_sqft", median_or_nan),
        valid_assessment_ratio_sale_count=("assessment_to_sale_equivalent_ratio", lambda s: s.notna().sum()),
        median_assessment_to_sale_ratio=("assessment_to_sale_equivalent_ratio", median_or_nan),
    )
    .reset_index()
)

large_condos = large_condos.merge(sale_stats, on="pin10", how="left")
for col in ["sale_count", "valid_per_sqft_sale_count", "valid_assessment_ratio_sale_count"]:
    large_condos[col] = large_condos[col].fillna(0).astype(int)

large_condos["pct_above_sale_psf_median"] = (
    large_condos["assessed_value_per_sqft"] - large_condos["median_assessed_equivalent_per_sqft"]
) / large_condos["median_assessed_equivalent_per_sqft"]


sale_psf_by_pin10 = {
    pin10: np.sort(group["assessed_equivalent_per_sqft"].dropna().to_numpy())
    for pin10, group in condo_sale_units.groupby("pin10")
}

large_condos["lower_sale_per_sqft_count"] = 0
for pin10, idx in large_condos.groupby("pin10").groups.items():
    sale_psf = sale_psf_by_pin10.get(pin10)
    if sale_psf is None or len(sale_psf) == 0:
        continue
    subject_psf = large_condos.loc[idx, "assessed_value_per_sqft"].to_numpy()
    lower_counts = np.searchsorted(sale_psf, subject_psf, side="left")
    lower_counts = np.where(np.isnan(subject_psf), 0, lower_counts)
    large_condos.loc[idx, "lower_sale_per_sqft_count"] = lower_counts.astype(int)

large_condos["pct_above_sale_ratio_median"] = large_condos["median_assessment_to_sale_ratio"] - 1


conditions = [
    large_condos["valid_per_sqft_sale_count"].ge(2)
    & large_condos["pct_above_sale_psf_median"].gt(CONDO_SALE_VALUE_SIGNAL_PERCENT)
    & large_condos["lower_sale_per_sqft_count"].ge(2),
    large_condos["valid_per_sqft_sale_count"].ge(2),
    large_condos["valid_assessment_ratio_sale_count"].ge(2)
    & large_condos["pct_above_sale_ratio_median"].gt(CONDO_SALE_VALUE_SIGNAL_PERCENT),
    large_condos["valid_assessment_ratio_sale_count"].ge(2),
    large_condos["sale_count"].gt(0),
]
choices = [
    "Yes, Appeal - condo sale psf signal",
    "No Appeal - condo sale psf signal",
    "Yes, Appeal - condo sale ratio signal",
    "No Appeal - condo sale ratio signal",
    "Not enough in-building sale data",
]
large_condos["current_large_condo_sale_branch_decision"] = np.select(
    conditions,
    choices,
    default="Falls through to uniformity comps",
)

decision_summary = (
    large_condos["current_large_condo_sale_branch_decision"]
    .value_counts(dropna=False)
    .rename_axis("decision")
    .reset_index(name="count")
)
decision_summary["share"] = decision_summary["count"] / len(large_condos)

print("\nLarge condo sale-branch decision proxy")
print("--------------------------------------")
print(decision_summary.to_string(index=False))


#%%
condo_building_uniformity = (
    condos.dropna(subset=["pin10", "assessed_value_per_sqft"])
    .groupby("pin10")
    .agg(
        building_units=("pin", "nunique"),
        median_assessed_value_per_sqft=("assessed_value_per_sqft", "median"),
        valid_units_with_psf=("assessed_value_per_sqft", "size"),
    )
    .reset_index()
)

condos_with_uniformity = condos.merge(condo_building_uniformity, on="pin10", how="left")
condos_with_uniformity["pct_above_building_median_psf"] = (
    condos_with_uniformity["assessed_value_per_sqft"]
    - condos_with_uniformity["median_assessed_value_per_sqft"]
) / condos_with_uniformity["median_assessed_value_per_sqft"]
condos_with_uniformity["rough_same_building_uniformity_signal"] = (
    condos_with_uniformity["valid_units_with_psf"].ge(5)
    & condos_with_uniformity["pct_above_building_median_psf"].gt(CONDO_SALE_VALUE_SIGNAL_PERCENT)
)

rough_uniformity_summary = (
    condos_with_uniformity["rough_same_building_uniformity_signal"]
    .value_counts(dropna=False)
    .rename_axis("rough_same_building_uniformity_signal")
    .reset_index(name="count")
)
rough_uniformity_summary["share"] = rough_uniformity_summary["count"] / len(condos_with_uniformity)

print("\nRough condo same-building uniformity signal")
print("------------------------------------------")
print(rough_uniformity_summary.to_string(index=False))


#%%
condo_problem_buildings = (
    large_condos.groupby("pin10")
    .agg(
        units=("pin", "nunique"),
        building_pin_count=("building_pin_count", "max"),
        sale_branch_yes=(
            "current_large_condo_sale_branch_decision",
            lambda s: s.str.startswith("Yes, Appeal").sum(),
        ),
        sale_branch_no=(
            "current_large_condo_sale_branch_decision",
            lambda s: s.str.startswith("No Appeal").sum(),
        ),
        sale_branch_not_enough=(
            "current_large_condo_sale_branch_decision",
            lambda s: s.eq("Not enough in-building sale data").sum(),
        ),
        sale_branch_fallback=(
            "current_large_condo_sale_branch_decision",
            lambda s: s.eq("Falls through to uniformity comps").sum(),
        ),
        recent_sale_count=("sale_count", "max"),
        valid_per_sqft_sale_count=("valid_per_sqft_sale_count", "max"),
        median_sale_psf=("median_assessed_equivalent_per_sqft", "max"),
        median_assessed_psf=("assessed_value_per_sqft", "median"),
    )
    .reset_index()
)

condo_problem_buildings["all_sale_branch_no_or_not_enough"] = (
    condo_problem_buildings["sale_branch_yes"].eq(0)
    & condo_problem_buildings["sale_branch_fallback"].eq(0)
)

print("\nLarge condo buildings where sale branch creates no appeal recommendation")
print("-----------------------------------------------------------------------")
print(
    condo_problem_buildings["all_sale_branch_no_or_not_enough"]
    .value_counts()
    .rename_axis("all_units_no_or_not_enough")
    .reset_index(name="building_count")
    .to_string(index=False)
)


#%%
# Dataframes to inspect interactively in VS Code/Jupyter:
# - decision_summary: count of current large-condo sale-branch outcomes
# - large_condos: per-unit condo sale-branch proxy decision
# - condos_with_uniformity: rough same-building uniformity signal for all condos
# - condo_problem_buildings: buildings where the current sale branch never recommends appeal
appeal_recommended_condos = large_condos.loc[
    large_condos["current_large_condo_sale_branch_decision"].str.startswith("Yes, Appeal")
].copy()

sale_branch_no_condos = large_condos.loc[
    large_condos["current_large_condo_sale_branch_decision"].str.startswith("No Appeal")
].copy()

not_enough_sale_data_condos = large_condos.loc[
    large_condos["current_large_condo_sale_branch_decision"].eq("Not enough in-building sale data")
].copy()

fallback_condos = large_condos.loc[
    large_condos["current_large_condo_sale_branch_decision"].eq("Falls through to uniformity comps")
].copy()

print("\nInteractive dataframe sizes")
print("---------------------------")
print(f"appeal_recommended_condos: {len(appeal_recommended_condos):,}")
print(f"sale_branch_no_condos: {len(sale_branch_no_condos):,}")
print(f"not_enough_sale_data_condos: {len(not_enough_sale_data_condos):,}")
print(f"fallback_condos: {len(fallback_condos):,}")
