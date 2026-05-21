#%%
import pandas as pd
import os

#%%
os.chdir('/Users/vuchicago/Python/property_tax_data_big')
df_output_all2025=pd.read_parquet('output_all_2025.parquet')
df_output_all2025.head(100)
# %%
