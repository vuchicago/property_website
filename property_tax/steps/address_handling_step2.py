#%%
import os
import pandas as pd
import time
import numpy as np
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from property_tax.utilities.address_lookup import LocalAddressLatLon, find_points_in_radius_tree, get_lat_lon_api


from sklearn.neighbors import BallTree
from data_step1 import ParcelSchema, PropDataDf, PropData


current_folder = '/Users/vuchicago/Python/property_tax'
data_path='/Users/vuchicago/Python/property_tax/data'
#os.chdir(data_path)

#%%
################### SAMPLE DATA ###################
# parcel_csv='parcel_sample.csv'
# df_parcel_sample=pd.read_csv(parcel_csv)
# df_parcel_sample=df_parcel_sample[df_parcel_sample['property_zip'].notnull()]
# df_parcel_sample['address']=df_parcel_sample['property_address']+' '+df_parcel_sample['property_city']+' '+df_parcel_sample['property_zip'].astype(int).astype(str)
# df_parcel_sample['address']=df_parcel_sample['address'].str.lower()

# # Convert degrees to radians
# coords_radians = np.radians(df_parcel_sample[['lat', 'lon']].values)
# tree = BallTree(coords_radians, metric='haversine')


# # %%
# addresses = df_parcel_sample["address"].tolist()

# start=time.time()
# n_workers = 10
# with ThreadPoolExecutor(max_workers=n_workers) as executor:
#     futures = [executor.submit(get_lat_lon_api, addr) for addr in addresses]

# results = [f.result() for f in futures]
# df_parcel_sample["lat"], df_parcel_sample["lon"] = zip(*results)
# end=time.time()
# print(f"Time taken: {end-start}")
# # %%
# df_parcel_sample=df_parcel_sample[df_parcel_sample['lat'].notnull()]
# df_parcel_sample['lat']=pd.to_numeric(df_parcel_sample['lat'])
# df_parcel_sample['lon']=pd.to_numeric(df_parcel_sample['lon'])



# sample_lat, sample_lon=41.78702215,-87.72429493368796
# sample_lat, sample_lon=42.047533,-87.733678
# find_points_in_radius_tree(tree, df_parcel_sample, sample_lat,sample_lon, radius_miles=3.0)
# # %%


##################### FULL DATASET
os.chdir(current_folder)
df_output_all=pd.read_csv('output_all.csv')

#%%
##This should work if the local api is running
df_output_all=df_output_all[df_output_all['address'].notnull()]
df_output_all['address']=df_output_all['address'].str.lower()
local_api_lookup=LocalAddressLatLon(df_output_all['address'])
start_time=time.time()
df_output_all=local_api_lookup.add_lat_lon_to_df(df_output_all)
end_time=time.time()
print(f"Time taken for full dataset lat/lon lookup: {(end_time-start_time)/3600} hours")
df_output_all.to_csv('output_all.csv',index=False)
#%%

# start=time.time()
# addresses=df_output_all['address'].tolist()
# n_workers = 10
# with ThreadPoolExecutor(max_workers=n_workers) as executor:
#     futures = [executor.submit(get_lat_lon_api, addr) for addr in addresses]

# results = [f.result() for f in futures]
# df_output_all['lat'],df_output_all['lon']=zip(*results)
# #df_output_all=df_output_all[df_output_all['lat'].notnull()]
# df_output_all['lat']=pd.to_numeric(df_output_all['lat'])
# df_output_all['lon']=pd.to_numeric(df_output_all['lon'])
# df_output_all.to_csv('output_all.csv',index=False)
# end=time.time()
# print(f"Time taken: {end-start}")



    #add another method to 
    
    
