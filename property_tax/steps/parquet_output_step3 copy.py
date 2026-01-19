#%%
import os
from pathlib import Path
import pandas as pd
import numpy as np
import re
from data_handling import PropData, extract_address, class_description

current_folder = Path(__file__).resolve().parent.parent
data_path=os.path.join(current_folder,'data')
#big_data_path=os.path.join(current_folder.parent,'property_tax_data_big')
big_data_path='/Users/vuchicago/Python/property_tax_data_big'
os.chdir(big_data_path)

#%%
df_output=pd.read_csv('output_all.csv')

# %%
df_output[df_output['lon'].notnull()].shape
# %%

df_output_remainder=df_output.loc[df_output['lat'].isnull(),:].copy()

#%%
sample_address='1555 w school st'
pd.set_option('display.max_rows', 500)
df_output_remainder.loc[df_output_remainder['address'].str.contains(sample_address,case=False),:].sort_values('address')
# %%
##function to extract the address from the address column to end in 'ST', 'AVE', 'DR', 'CIR', 'CT', 'LN', 'PL', 'RD', 'WAY'
### Remove apartment numbers at the end of the address if it exists


#%%
os.chdir(data_path)


#%%
os.chdir(big_data_path)
#%%
data=PropData([2024])
df_parcel=data.df_parcel()
#df_appeals=data.df_appeals()
df_assessed=data.df_assessed()
df_prop_characters=pd.read_csv('Assessor_-_Single_and_Multi-Family_Improvement_Characteristics_20250117.csv')
# %%
df_appeals_all=data.df_appeals_all()
df_last_appeal=df_appeals_all.sort_values(by=['pin','tax_year'],ascending=[True,False]).drop_duplicates(subset='pin')
df_last_appeal=df_last_appeal.rename(columns={'tax_year':'last_appeal_year','change':'last_appeal_status','reason_desc1':'last_appeal_reason'})

#%%
col_keep_parcels=['pin','tax_year','property_address','property_city','property_state','property_zip']
col_keep_assessed=['pin','tax_year','township_name','neighborhood_code','certified_bldg','certified_land','certified_tot','class']
col_keep_appeals=['pin','last_appeal_year','appeal_type','status','last_appeal_status','last_appeal_reason']
col_keep_characters=['pin','tax_year','card_num','township_code','pin_proration_rate','card_proration_rate','pin_is_multicard','pin_is_multiland',\
                'year_built','building_sqft','num_bedrooms','num_rooms','num_full_baths','num_half_baths','type_of_residence','construction_quality',\
                'num_apartments','garage_attached','garage_size','attic_type','basement_type','ext_wall_material','central_heating','repair_condition','basement_finish',\
                'single_v_multi_family','site_desirability','num_commercial_units','renovation','recent_renovation','central_air','design_plan']



#%%
df_parcel=df_parcel.loc[df_parcel['property_address'].notnull(),:]
df_parcel['property_address']=df_parcel['property_address'].str.lower()

# %%
# %%
###get the 
df_prop_characters_all=df_prop_characters.sort_values(by=['pin','tax_year'],ascending=[True,False]).drop_duplicates(subset='pin')

# %%
df_output_all=pd.merge(df_parcel[col_keep_parcels],df_assessed[col_keep_assessed],how='inner',on=['pin','tax_year'])
print(df_output_all.shape)
df_output_all=pd.merge(df_output_all,df_prop_characters_all[col_keep_characters].rename(columns={'tax_year':'tax_year_characters'}),how='left',on=['pin'])
print(df_output_all.shape)
df_output_all=pd.merge(df_output_all,df_last_appeal[col_keep_appeals],how='left',on=['pin'])
print(df_output_all.shape)

df_output_all[df_output_all['property_address'].str.contains(sample_address,case=False)]

# %%
df_output_all_missing_characters=df_output_all.loc[df_output_all['tax_year_characters'].isna(),:]

# %%
pd.set_option('display.max_rows', None)
print(df_output_all_missing_characters['class'].value_counts())
df_output_all[df_output_all['tax_year_characters'].notnull()]['class'].value_counts()
# %%
#%%
#### extract address function to clean up addresses from apartment #s
df_output_all['property_address_fixed'],df_output_all['property_address_condo_fixed']=df_output_all['property_address'].apply(extract_address)
#%%
df_output_all['address']=df_output_all['property_address_fixed']+' '+df_output_all['property_city']+' ' + df_output_all['property_zip'].astype(int).astype(str)
df_output_all['address']=df_output_all['address'].str.lower()
# %%

# %%
pin_current=df_output.loc[df_output['lon'].notnull(),'pin'].to_list()

pin_remainder=list(set(df_output_all['pin'].to_list())-set(pin_current))

#%%
df_output=pd.merge(df_output_all,df_output[['pin','lat','lon']],how='inner',on='pin')

#%%
df_output_remainder=df_output_all.loc[df_output_all['pin'].isin(pin_remainder),:]
# %%
from address_lookup import find_points_in_radius_tree, get_lat_lon_api
from concurrent.futures import ThreadPoolExecutor
import time 

start=time.time()
addresses=df_output_remainder['address'].tolist()
n_workers = 10
with ThreadPoolExecutor(max_workers=n_workers) as executor:
    futures = [executor.submit(get_lat_lon_api, addr) for addr in addresses]

results = [f.result() for f in futures]
df_output_remainder['lat'],df_output_remainder['lon']=zip(*results)

#%%
#df_output_all=df_output_all[df_output_all['lat'].notnull()]
df_output_remainder['lat']=pd.to_numeric(df_output_remainder['lat'])
df_output_remainder['lon']=pd.to_numeric(df_output_remainder['lon'])

#%%
#### REMAINING ADDRESSES
df_output_remainder[df_output_remainder['lat'].isnull()].sample(100)

#%%

# df_output_remainder.to_csv('output_remainder.csv',index=False)

# %%
os.chdir(big_data_path)
df_output_remainder=pd.read_csv('output_remainder.csv')
# %%
df_output_remainder.head()
# %%
df_output_remainder_remainder=df_output_remainder.loc[df_output_remainder['lat'].isnull(),:]
df_output_remainder_remainder.head()

# %%
df_output_remainder_remainder.sample(100)
# %%

df_output_remainder_remainder['address']=df_output_remainder_remainder['property_address']+' '+df_output_remainder_remainder['property_city']+' ' + df_output_remainder_remainder['property_zip'].astype(int).astype(str)
df_output_remainder_remainder['address']=df_output_remainder_remainder['address'].str.lower()
df_output_remainder_remainder['address'],df_output_remainder_remainder['address_condo']=df_output_remainder_remainder['address'].apply(extract_address)

# %%
os.chdir(data_path)
from address_lookup import find_points_in_radius_tree, get_lat_lon_api
from concurrent.futures import ThreadPoolExecutor
import time 

start=time.time()
addresses=df_output_remainder_remainder['address'].tolist()
n_workers = 10
with ThreadPoolExecutor(max_workers=n_workers) as executor:
    futures = [executor.submit(get_lat_lon_api, addr) for addr in addresses]

results = [f.result() for f in futures]
df_output_remainder_remainder['lat'],df_output_remainder_remainder['lon']=zip(*results)
# %%
df_output_remainder_remainder.head()
# %%
pd.set_option('display.max_rows', 200)
df_output_remainder_remainder[df_output_remainder_remainder['lat'].isnull()].shape
# %%
os.chdir(big_data_path)
df_output_remainder_remainder.to_csv('output_remainder_remainder.csv',index=False)
# %%
df_output_remainder_remainder.township_name.value_counts()
df_output_remainder_remainder.property_city.value_counts()
# %%
df_output_remainder_remainder[(df_output_remainder_remainder['lat'].isnull())].shape
# %%


# %%
df_output_remainder_remainder=pd.read_csv('output_remainder_remainder.csv')
#%%

set(df_output_remainder_remainder.columns)-set(df_output.columns)
# %%
df_output['property_address_fixed']=df_output['property_address'].apply(extract_address)
df_output['address']=df_output['property_address_fixed']+' '+df_output['property_city']+' ' + df_output['property_zip'].astype(int).astype(str)
df_output['address']=df_output['address'].str.lower()

df_output=df_output.loc[df_output['lat'].notnull(),:]
# %%
df_output.head()
# %%
df_output_final=pd.concat([df_output[df_output['lat'].notnull()],df_output_remainder[df_output_remainder['lat'].notnull()]],axis=0)
df_output_final=pd.concat([df_output_final,df_output_remainder_remainder[df_output_remainder_remainder['lat'].notnull()]],axis=0)

df_output_final.shape
# %%
df_output_final.loc[:, 'bathroom_count']=df_output_final['num_full_baths']+df_output_final['num_half_baths']

#%%
df_output_final['class'] = df_output_final['class'].astype(str)
df_output_final['Class Description']=df_output_final['class'].apply(class_description)

# %%
col_rename={'address':'Nearby Address',
                                'property_city':'City',
                            'property_zip':'Zip Code',
                            'last_appeal_year':'Last Appeal Year',
                            'certified_tot':'Taxable Value',
                            'building_sqft':'Home Size',
                            'certified_land':'Certified Land',
                            'certified_bldg':'Certified Building',
                            'last_appeal_status':'Last Appeal Status',
                            'neighborhood_code':'Neighborhood Code',
                            'num_bedrooms':'Bedroom Count',
                            'bathroom_count':'Bathroom Count',
                            'ext_wall_material':'Masonry Type',
                            'basement_finish':'Finished Basement',
                            'pin_proration_rate':'PIN Proration Rate',
                            'single_v_multi_family':'Single vs Multi Family',
                            'garage_size':'Garage Size',
                            'class_description':'Class Description'}
df_output_final=df_output_final.rename(columns=col_rename)

#%%
col_keep_new=['Nearby Address','Taxable Value','Last Appeal Year','Certified Land','Certified Building','Home Size',
                          'Last Appeal Status','Bedroom Count','Bathroom Count','Masonry Type','Finished Basement',
                          'Single vs Multi Family','Neighborhood Code','Garage Size','Class Description','PIN Proration Rate','pin','lat','lon','class']


#%%
print(df_output_final.shape)
df_output_final=df_output_final.loc[df_output_final['Nearby Address'].notnull(),:] 
print(df_output_final.shape)
#%%
df_output_final['Zip Code']=df_output_final['Zip Code'].astype(int)
df_output_final['Nearby Address']=df_output_final['property_address'].str.lower()+' '+df_output_final['City'].str.lower()+' ' + df_output_final['Zip Code'].astype(int).astype(str)
df_output_final[col_keep_new].sample(100)
# %%
#### For null 
df_output_null = pd.DataFrame({
    'Nearby Address': ["No Matches in Radius"],
    'Taxable Value': [0],
    'Last Appeal Year': [0],
    'Certified Land': [0],
    'Certified Building': [0],
    'Home Size': [0],
    'Last Appeal Status': ['None'],
    'Bedroom Count': [0],
    'Bathroom Count': [0],
    'Masonry Type': ['None'],
    'Finished Basement': ['None'],
    'Single vs Multi Family': ['None'],
    'Neighborhood Code': [0],
    'Garage Size': ['None'],
    'Class Description': ['None'],
    'PIN Proration Rate': [0],
    'pin': [0],
    'lat': [0],
    'lon': [0]
})

df_output_final=pd.concat([df_output_final,df_output_null],axis=0)

#%%
#%%
os.chdir(big_data_path)
df_output_final=pd.read_parquet('output_all_1.6M.parquet')
#%%
####CREATE DEFAULT SAMPLES FOR INITIAL LOADING
df_output_sample = pd.DataFrame([
    {
        'Nearby Address': "No Matches in Radius",
        'Taxable Value': 0,
        'Last Appeal Year': 0,
        'Certified Land': 0,
        'Certified Building': 0,
        'Home Size': 0,
        'Last Appeal Status': 'None',
        'Bedroom Count': 0,
        'Bathroom Count': 0,
        'Masonry Type': 'None',
        'Finished Basement': 'None',
        'Single vs Multi Family': 'None',
        'Neighborhood Code': 0,
        'Garage Size': 'None',
        'Class Description': 'None',
        'PIN Proration Rate': 0,
        'pin': 1000000000000,
        'lat': 0,
        'lon': 0,
        'class':'0'
    },
    {
        'Nearby Address': "123 cook county compare st",
        'Taxable Value': 42000,
        'Last Appeal Year': 2024,
        'Certified Land': 21000,
        'Certified Building': 27000,
        'Home Size': 2300,
        'Last Appeal Status': 'change',
        'Bedroom Count': 4,
        'Bathroom Count': 3,
        'Masonry Type': 'Frame + Masonry',
        'Finished Basement': 'Formal Rec Room',
        'Single vs Multi Family': 'Single-Family',
        'Neighborhood Code': 999,
        'Garage Size': '2 cars',
        'Class Description': 'Residential',
        'PIN Proration Rate': 1,
        'pin': 1000000000001,
        'lat': 50,
        'lon': -100,
        'class':'234'
    },
    {
        'Nearby Address': "123 sample st",
        'Taxable Value': 40000,
        'Last Appeal Year': 2022,
        'Certified Land': 20000,
        'Certified Building': 20000,
        'Home Size': 2100,
        'Last Appeal Status': 'change',
        'Bedroom Count': 4,
        'Bathroom Count': 3,
        'Masonry Type': 'Frame + Masonry',
        'Finished Basement': 'Formal Rec Room',
        'Single vs Multi Family': 'Single-Family',
        'Neighborhood Code': 999,
        'Garage Size': '2 cars',
        'Class Description': 'Residential',
        'PIN Proration Rate': 1,
        'pin': 1000000000002,
        'lat': 50,
        'lon': -100,
        'class':'234'
    },
        {
        'Nearby Address': "123 cookcountytaxcompare.com st",
        'Taxable Value': 41000,
        'Last Appeal Year': 2022,
        'Certified Land': 20000,
        'Certified Building': 21000,
        'Home Size': 2200,
        'Last Appeal Status': 'change',
        'Bedroom Count': 4,
        'Bathroom Count': 3,
        'Masonry Type': 'Frame + Masonry',
        'Finished Basement': 'Formal Rec Room',
        'Single vs Multi Family': 'Single-Family',
        'Neighborhood Code': 999,
        'Garage Size': '2 cars',
        'Class Description': 'Residential',
        'PIN Proration Rate': 1,
        'pin': 1000000000003,
        'lat': 50,
        'lon': -100,
        'class':'234'
    }
])
df_output_final=pd.concat([df_output_final,df_output_sample],axis=0)



#%%


#%%
df_output_final[col_keep_new].to_parquet('output_all_1.6M.parquet',index=False)
# %%
df_output_remainder_remainder[df_output_remainder_remainder['address'].str.contains('1221 sunnyside',case=False)]
# %%
df_output_final[df_output_final['Nearby Address'].str.contains('No Matches in Radius',case=False)]
# %%
df_output_remainder3=df_output_remainder_remainder[df_output_remainder_remainder['lat'].isnull()].copy()
# %%
os.chdir(data_path)
from address_lookup import find_points_in_radius_tree, get_lat_lon_api
from concurrent.futures import ThreadPoolExecutor
import time 

start=time.time()
addresses=df_output_remainder3['property_address_fixed'].tolist()
#addresses=df_output_remainder3[df_output_remainder3['address'].str.contains('1221 sunnyside',case=False)]['property_address_fixed'].tolist()
n_workers = 10
with ThreadPoolExecutor(max_workers=n_workers) as executor:
    futures = [executor.submit(get_lat_lon_api, addr) for addr in addresses]

results = [f.result() for f in futures]
results
#%%
df_output_remainder3['lat'],df_output_remainder3['lon']=zip(*results)
# %%

# %%
#quynh parents pin. Check why it's missing
df_output_remainder3[df_output_remainder3.pin==10271090440000]

# %%
df_output_remainder3['class_description']=df_output_remainder3['class'].apply(class_description)
df_output_remainder3['bathroom_count']=df_output_remainder3['num_full_baths']+df_output_remainder3['num_half_baths']
df_output_remainder3=df_output_remainder3.rename(columns=col_rename)
# %%
df_output_final_1_7M=pd.concat([df_output_final[col_keep_new],df_output_remainder3[df_output_remainder3['lat'].notnull()][col_keep_new]])    

# %%
##make sure dtypes are the same

df_output_final_1_7M[['lat','lon']]=df_output_final_1_7M[['lat','lon']].apply(pd.to_numeric)

#%%
####SAVE
df_output_final_1_7M[col_keep_new].to_parquet('output_all_1.7M.parquet',index=False)

# %%


