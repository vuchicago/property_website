import os
import streamlit as st
st.set_page_config(page_title="Property Taxes Comparables", layout="wide")  # <-- FIRST Streamlit command
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import tempfile
import logging
from backend.utilities.generate_data import PropertyMatch
# Convert degrees to radians
app_dir = Path(__file__).resolve().parent
data_path=app_dir
#%%
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
os.chdir(data_path)

# Load data (replace with your actual data loading logic)
@st.cache_data
def load_data():
    # Replace with your actual parquet file path
    parquet_file = "output_all_1.6M.parquet"
    df = pd.read_parquet(parquet_file)
    df = df[df['Nearby Address'].notnull()]
    df['Nearby Address'] = df['Nearby Address'].str.lower()
    df = df[df['lat'].notnull()]
    return df

df_parcel_sample = load_data()
all_addresses = df_parcel_sample['Nearby Address'].tolist()
property_match = PropertyMatch(df_parcel_sample)

# Streamlit UI

st.title("Cook County Property Tax Comparables")

# Sidebar for address and radius input
# ...existing code...

with st.sidebar:
    st.header("Search Parameters")
    # Step 1: User types in a query
    address_query = st.text_input(
        "Start typing your address",
        value="8501 christiana ave skokie 60076",
        help="Type part of your address to search"
    )
    # Step 2: Filter addresses based on query
    filtered_addresses = [a for a in all_addresses if address_query.lower() in a.lower()]
    filtered_addresses = filtered_addresses[:5] if filtered_addresses else all_addresses[:10]
    # Step 3: User selects from filtered addresses
    address = st.selectbox(
        "Select Your Address from Dropdown",
        filtered_addresses,
        index=0 if filtered_addresses else None
    )
    radius = st.slider("Radius of Comps (miles)", min_value=0.1, max_value=5.0, value=0.5, step=0.1)
    if st.button("Reset"):
        address_query = "8501 christiana ave skokie 60076"
        address = "8501 christiana ave skokie 60076"
        radius = 0.5
    st.markdown("Calculations can TAKE UP TO 15 SECONDS")

# Update matches when address or radius changes
property_match.update_matches(address, radius)
results = property_match.match_properties()
df_input = df_parcel_sample[df_parcel_sample['Nearby Address'].str.contains(address, case=False)]

# Helper functions
def appeal_result(results, df_input):
    if df_input.empty or results.empty:
        return "Please Enter Address"
    avg_value = results['Taxable Value'].mean()
    value = df_input['Taxable Value'].values[0]
    lower_value = results.loc[results['Taxable Value'] < value].shape[0]
    last_appeal = df_input['Last Appeal Year'].values[0]
    if pd.isna(last_appeal):
        last_appeal = "No Appeal in past 12 years"
    else:
        last_appeal = int(last_appeal)
    if (value - avg_value) / avg_value > .02:
        return "Yes, Appeal"
    elif (last_appeal == datetime.now().year):
        return "No Appeal"
    elif (lower_value > 4):
        return "Yes, Appeal"
    elif (isinstance(last_appeal, int) and last_appeal < datetime.now().year - 3):
        return "Yes, Appeal"
    else:
        return "No Need to Appeal"

def results_reason(results, df_input):
    if df_input.empty or results.empty:
        return ""
    avg_value = results['Taxable Value'].mean()
    value = df_input['Taxable Value'].values[0]
    comps_count = results.shape[0]
    lower_value = results.loc[results['Taxable Value'] < value].shape[0]
    last_appeal = df_input['Last Appeal Year'].values[0]
    if pd.isna(last_appeal):
        last_appeal = "No Appeal in past 12 years"
    else:
        last_appeal = int(last_appeal)
    if (value - avg_value) / avg_value > .02:
        return f"Your taxable value is {(value - avg_value) / avg_value:.2%} higher than avg comps & {lower_value} comps have lower taxable value"
    elif (last_appeal == datetime.now().year):
        return "You just appealed recently"
    elif (lower_value > 4):
        return f"Your taxable value is > {lower_value} comps. There are {comps_count} comps in radius."
    elif (isinstance(last_appeal, int) and last_appeal < datetime.now().year - 3):
        return "It's been > 3 years since last appeal"
    else:
        return "Your taxable value is in line with comps"

# Main columns
col1, col2, col3 = st.columns(3)
with col1:
    st.subheader("Should You Appeal?")
    st.info(appeal_result(results, df_input))

with col2:
    st.subheader("Reason")
    st.write(results_reason(results, df_input))

with col3:
    st.subheader("Property Details")
    if not df_input.empty:
        unit_type = df_input['Class Description'].values[0]
        value = df_input['Taxable Value'].values[0]
        last_appeal = df_input['Last Appeal Year'].values[0]
        if pd.isna(last_appeal):
            last_appeal = "No Appeal in past 12 years"
        else:
            last_appeal = int(last_appeal)
        num_of_comps = results.shape[0]
        
        st.write(f"Type: {unit_type}")
        st.write(f"Taxable Value: ${value:,.0f}")
        if 'Bedroom Count' in df_input and 'Bathroom Count' in df_input and 'Home Size' in df_input:
            st.write(f"{int(df_input['Bedroom Count'].values[0])} beds, {int(df_input['Bathroom Count'].values[0])} baths, {int(df_input['Home Size'].values[0])} sqft")
        st.write(f"Last Appeal Year: {last_appeal}")
        st.write(f"Number of Comps Found: {num_of_comps}")
st.markdown("---")
st.subheader("Comparable Properties in Radius")
if not results.empty:
    st.plotly_chart(property_match.output_shiny(results=results))
    st.dataframe(results)
    st.download_button("Download CSV", results.to_csv(index=False), file_name="comps.csv")
    ###display plotly chart

else:
    st.write("No comparable properties found.")

st.markdown("""
---
©2024 Cook County Tax Compare LLC. All Rights Reserved.  
[ABOUT US & CONTACT](https://cookcountytaxcompare.com/contact/)
""")