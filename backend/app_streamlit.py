#%%
import os
import re

import pandas as pd
from datetime import datetime
from pathlib import Path
import logging

from rapidfuzz import process, fuzz
import folium
import streamlit as st
from streamlit.components.v1 import html
from huggingface_hub import HfApi
from streamlit_javascript import st_javascript
import pytz 
from property_tax_appeal_vn.utilities.generate_data import PropertyMatch

st.set_page_config(page_title="Property Taxes Comparables", layout="wide")  # <-- FIRST Streamlit command
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
    parquet_file = "output_all_1.7M.parquet"
    df = pd.read_parquet(parquet_file)
    df = df[df['Nearby Address'].notnull()]
    df['Nearby Address'] = df['Nearby Address'].str.lower()
    df = df[df['lat'].notnull()]
    return df

df_parcel_sample = load_data()
all_addresses = df_parcel_sample['Nearby Address'].tolist()
property_match = PropertyMatch(df_parcel_sample)



# —— Move search and suggestions to sidebar ——
with st.sidebar:
    st.header("Search Properties")
    # Clear button
    if st.button("CLEAR", help="Clear address search"):
        st.session_state["address_query"] = ""
    address_query = st.text_input(
        "Start typing your address",
        value=st.session_state.get("address_query", ""),
        key="address_query",
        help="Type part of your address to search",
        placeholder="example: 123 Cook County st Chicago 60644",
    )

    # —— Filter & take top 8 using fuzzy search ——
    def split_address(address):
        # Extract leading digits and the rest
        match = re.match(r"(\d+)\s*(.*)", address.lower().strip())
        if match:
            digits = match.group(1)
            rest = match.group(2)
        else:
            digits = ""
            rest = address.strip()
        return digits, rest

    address_query = st.session_state.get("address_query", "1234 w campbell st arlington heights 60005")
    digits, rest = split_address(address_query)

    # Filter all_addresses for those that start with the same digits
    if digits:
        digit_matches = [a for a in all_addresses if a.strip().startswith(digits)]
    else:
        digit_matches = all_addresses

    # Fuzzy match on the rest of the address
    if rest:
        matches = [
            match[0]
            for match in process.extract(
                rest,
                digit_matches,
                scorer=fuzz.WRatio,
                limit=8
            )
        ]
    else:
        matches = digit_matches[:8]

    address = st.selectbox(
        "Suggestions",
        matches,
        help="Select one of the top 8 matches"
    )

    st.write("You picked:", address)

    radius = st.slider("Radius of Comps (miles)", min_value=0.1, max_value=5.0, value=0.5, step=0.1)
    if st.button("Reset"):
        address_query = "19412 oakwood ave lynwood 60411"
        address = "19412 oakwood ave lynwood 60411"
        radius = 0.5
    
    # Update matches when address or radius changes
    property_match.update_matches(address, radius)
    results = property_match.match_properties()
    df_input = df_parcel_sample[df_parcel_sample['Nearby Address'].str.contains(address, case=False)]
    
    st.subheader("Taxable Valuations")
    st.plotly_chart(property_match.output_shiny(results=results))





# Use fuzzy match for df_input as well
if address:
    # Find the best match in the DataFrame using rapidfuzz
    best_match = process.extractOne(
        address,
        df_parcel_sample['Nearby Address'],
        scorer=fuzz.WRatio
    )
    if best_match:
        df_input = df_parcel_sample[df_parcel_sample['Nearby Address'] == best_match[0]]
    else:
        df_input = pd.DataFrame()
else:
    df_input = pd.DataFrame()

# Helper functions
def appeal_result(results, df_input):
    if df_input.empty or results.empty or df_input.iloc[0]["Nearby Address"]=="19412 oakwood ave lynwood 60411":
        return "Please Enter Valid Cook County Address"
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

appeal_result_verdict=appeal_result(results, df_input)
reasons_result_verdict=results_reason(results, df_input)
# Main columns
col1, col2, col3 = st.columns(3)
with col1:
    st.subheader("Should You Appeal?")
    st.info(appeal_result_verdict)
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

        if 'Bedroom Count' in df_input and 'Bathroom Count' in df_input and 'Home Size' in df_input:
            st.write(f"{int(df_input['Bedroom Count'].values[0])} beds, {int(df_input['Bathroom Count'].values[0])} baths, {int(df_input['Home Size'].values[0])} sqft")
        st.write(f"Taxable Value: ${value:,.0f}")
        st.write(f"Last Appeal Year: {last_appeal}")
        st.write(f"Number of Comps Found: {num_of_comps}")





st.subheader(f"{len(results)} comps found within {radius} mile radius (not all shown on map)")

# Get coordinates for the selected address (df_input) and matches (results)
if not df_input.empty and not results.empty:
    # Center map on the selected address
    center_lat = df_input.iloc[0]['lat']
    center_lon = df_input.iloc[0]['lon']
    m = folium.Map(location=[center_lat, center_lon], zoom_start=15)

    # Draw a semi-transparent circle for the selected radius (convert miles to meters)
    folium.Circle(
        location=[center_lat, center_lon],
        radius=radius * 1609.34,  # miles to meters
        color='blue',
        fill=True,
        fill_color='blue',
        fill_opacity=0.15,
        popup=f"Radius: {radius} miles"
    ).add_to(m)

    # Add marker for the selected address (in red)
    folium.Marker(
        [center_lat, center_lon],
        popup=f"<b style='color:red'>{df_input.iloc[0]['Nearby Address']}</b>",
        icon=folium.Icon(color='red', icon='home')
    ).add_to(m)

    # Add markers for all nearby matches (in blue), skip the selected address if present in results
    for _, row in results.iterrows():
        if (row['lat'] == center_lat) and (row['lon'] == center_lon):
            continue  # Skip if it's the selected address
        folium.Marker(
            [row['lat'], row['lon']],
            popup=f"<b style='color:blue'>{row['Nearby Address']}</b>",
            icon=folium.Icon(color='blue', icon='info-sign')
        ).add_to(m)

    # Render the map in Streamlit
    html(m._repr_html_(), height=400)
else:
    st.write("Map is not available without a valid address selection.")
st.subheader("Table of Comparable Properties in Radius")

if not results.empty:
    # Remove index for display
    st.dataframe(results.set_index("Nearby Address"))
    st.download_button("Download CSV", results.to_csv(index=False), file_name="comps.csv")
    ###display plotly chart

else:
    st.write("No comparable properties found.")


# with col1:
#     st.subheader("Should You Appeal?")
#     st.info(appeal_result(results, df_input))
# with col2:
#     st.subheader("Reason")
#     st.write(results_reason(results, df_input))

# Set up Hugging Face token and repo info





user_agent = st_javascript("navigator.userAgent")

if user_agent:
    ua = user_agent.lower()
    if "android" in ua:
        device = "Android"
    elif "iphone" in ua or "ipad" in ua:
        device = "iOS"
    else:
        device = "Desktop"
else:
    logging.info(st.warning("Couldn’t read user agent; try reloading."))
    device = "Unknown"


# # 1) pick a writable base path
# if os.path.isdir("/persistent"):
#     STORAGE = "/persistent"
# elif os.path.isdir("/mnt/data"):
#     STORAGE = "/mnt/data"
# else:
#     STORAGE = "/tmp"  # /tmp is always writable

# # ensure it exists
# os.makedirs(STORAGE, exist_ok=True)

# # 2) point HOME at your writable area so Streamlit can write ~/.streamlit there
# os.environ["HOME"] = STORAGE
# # … your STORAGE / HOME setup here …

# LOCAL_DATASET_PATH = os.path.join(STORAGE, "address_search_dataset")
# os.makedirs(LOCAL_DATASET_PATH, exist_ok=True)

# HF_TOKEN = os.getenv("HF_TOKEN")
# REPO_ID   = "vuchicago/address_search"

# PARQUET_FILE = os.path.join(LOCAL_DATASET_PATH, "data.parquet")

# def load_or_create_dataset():
#     # 1) If we've ever written locally, just use that.
#     if os.path.isfile(PARQUET_FILE):
#         return pd.read_parquet(PARQUET_FILE)

#     # 2) Otherwise, try pulling from the hub.
#     try:
#         ds = load_dataset(REPO_ID, split="train")
#         return ds.to_pandas()
#     except Exception:
#         # 3) If there’s nothing upstream yet, start with an empty frame
#         return pd.DataFrame(columns=[
#             "address", "result", "reason", "radius", "comp_count",
#             "last_appeal", "home_size", "bedroom_count",
#             "bathroom_count", "timestamp","device"
#         ])

# def append_address_search(address):
#     # load whatever’s out there today
#     data = load_or_create_dataset()
#     central = pytz.timezone("US/Central")
#     now_central = datetime.now(central)

#     new_row = {
#         "address":        address,
#         "result":         appeal_result_verdict,
#         "reason":         reasons_result_verdict,
#         "radius":         radius,
#         "comp_count":     len(results),
#         "last_appeal":    int(df_input['Last Appeal Year'].iloc[0]) if not pd.isna(df_input['Last Appeal Year'].iloc[0]) else None,
#         "property_type":  df_input['Class Description'].values[0],
#         "home_size":      df_input['Home Size'].iloc[0],
#         "bedroom_count":  df_input['Bedroom Count'].iloc[0],
#         "bathroom_count": df_input['Bathroom Count'].iloc[0],
#         "my_value":     df_input['Taxable Value'].iloc[0] if not df_input.empty else None,
#         "avg_comp_value": results['Taxable Value'].mean() if not results.empty else None,
#         "timestamp":      now_central,
#         "device":         device
#     }

#     # append and overwrite the single parquet file
#     data = pd.concat([data, pd.DataFrame([new_row])], ignore_index=True)
#     data.to_parquet(PARQUET_FILE, index=False)

#     # push the full, updated file back to HF
#     api = HfApi(token=HF_TOKEN)
#     api.upload_folder(
#         folder_path=LOCAL_DATASET_PATH,
#         repo_id=REPO_ID,
#         repo_type="dataset",
#     )


# # Example
# append_address_search(address)


st.markdown("""
---
©2024 Cook County Tax Compare LLC. All Rights Reserved.  
[ABOUT US & CONTACT](https://cookcountytaxcompare.com/contact/)
""")