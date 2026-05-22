#%%
import pandas as pd
import os

#%%
data_big='/Users/vuchicago/Python/property_tax_data_big'
data_current='/Users/vuchicago/Python/property_tax'
os.chdir(data_current)
df_output_all2025=pd.read_parquet('output_all_2025.parquet')
print(df_output_all2025.shape)
# %%
appeals= 'Assessor_-_Appeals_20260306.csv'
characteristics='Assessor_-_Single_and_Multi-Family_Improvement_Characteristics_20260314.csv'
characteristics_condos='Assessor_-_Residential_Condominium_Unit_Characteristics_20260520.csv'
parcel='Assessor_-_Parcel_Addresses_20260315.csv'
parcel_universe='Assessor_-_Parcel_Universe_(Current_Year_Only)_20260306.csv'
assessed='Assessor_-_Assessed_Values_20260314.csv'

def read_csv_for_tax_year(file_name, tax_year, chunksize=50_000, **read_csv_kwargs):
    chunks = []
    for chunk in pd.read_csv(file_name, chunksize=chunksize, low_memory=False, **read_csv_kwargs):
        chunk = chunk.loc[chunk['tax_year'] == tax_year]
        if not chunk.empty:
            chunks.append(chunk)

    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
os.chdir(data_big)
#%%
df_parcel_universe=read_csv_for_tax_year(parcel_universe,tax_year=2026)
#%%
df_assessed=read_csv_for_tax_year(assessed,tax_year=2025)

#%%
df_characters=read_csv_for_tax_year(characteristics,tax_year=2025)
print(df_characters.columns)

# %%
df_parcel_universe[df_parcel_universe.pin=='10271090440000']
#%%
df_parcel=read_csv_for_tax_year(parcel,tax_year=2025)
print(df_parcel.shape)

#%%
df_parcel[df_parcel.pin==10271090440000]
# %%
df_output_all2025[df_output_all2025.pin=='09211020010000']
# %%
df_duplicated=df_output_all2025[(df_output_all2025['Nearby Address'].duplicated()) & (df_output_all2025['PIN Proration Rate']==1)].copy()
# %%
df_duplicated[df_duplicated.pin=='27162050090000']
# %%
df_duplicated[df_duplicated['Nearby Address']=='9845 El Cameno Ln, Orland Park, IL 60462']

# %%
