#%%
import os
import pandas as pd
import numpy as np
from pathlib import Path
import csv
import logging

from functools import cached_property
from property_tax.utilities.data_handling import PropData, extract_address, class_description
from property_tax.schemas.imported_schemas import ParcelSchema, PropDataDf

#%%
current_folder = Path(__file__).resolve().parent.parent

big_data_path = '/Users/vuchicago/Python/property_tax_data_big'
print(f"data_path: {current_folder}")
print(f"big_data_path: {big_data_path}")



# Example usage
#%%
def output_data(year: list[int], data_path: str =big_data_path):
    os.chdir(data_path)
    data=PropData(year)
    #df_appeals=data.df_appeals()
    df_assessed=data.df_assessed()
    df_parcel=data.df_parcel()
    df_prop_characters=data.df_prop_characters()
    df_parcel_copy=df_parcel.copy()
    df_parcel_copy.dtypes=ParcelSchema.schema

    col_keep_parcels=['pin','tax_year','property_address','property_city','property_state','property_zip']
    col_keep_assessed=['pin','tax_year','township_name','neighborhood_code','certified_bldg','certified_land','certified_tot']
    col_keep_appeals=['pin','last_appeal_year','appeal_type','status','last_appeal_status','last_appeal_reason']
    col_keep_characters=['pin','tax_year','card_num','class','township_code','pin_proration_rate','card_proration_rate','pin_is_multicard','pin_is_multiland',\
                        'year_built','building_sqft','num_bedrooms','num_rooms','num_full_baths','num_half_baths','type_of_residence','construction_quality',\
                        'num_apartments','garage_attached','garage_size','attic_type','basement_type','ext_wall_material','central_heating','repair_condition','basement_finish',\
                        'single_v_multi_family','site_desirability','num_commercial_units','renovation','recent_renovation','central_air','design_plan']


    df_appeals_all=data.df_appeals_all()

    df_last_appeal=df_appeals_all.sort_values(by=['pin','tax_year'],ascending=[True,False]).drop_duplicates(subset='pin')
    df_last_appeal=df_last_appeal.rename(columns={'tax_year':'last_appeal_year','change':'last_appeal_status','reason_desc1':'last_appeal_reason'})
    df_last_appeal['last_appeal_year']=df_last_appeal['last_appeal_year'].fillna(0).astype(int).replace(0,"No Appeal").astype(str)

    df_output_all=pd.merge(df_parcel[col_keep_parcels],df_assessed[col_keep_assessed],how='inner',on=['pin','tax_year'])
    df_output_all=pd.merge(df_output_all,df_prop_characters[col_keep_characters],how='inner',on=['pin','tax_year'])
    df_output_all=pd.merge(df_output_all,df_last_appeal[col_keep_appeals],how='left',on=['pin'])
    df_output_all.head()

    df_output_all=df_output_all[df_output_all['property_zip'].notnull()]
    df_output_all['property_zip']=df_output_all['property_zip'].astype(int)
    df_output_all['property_address_fixed'],df_output_all['property_address_condo_fixed']=df_output_all['property_address'].apply(extract_address)
    df_output_all['address']=df_output_all['property_address_fixed']+' '+df_output_all['property_city']+' '+df_output_all['property_zip'].astype(int).astype(str)
    df_output_all['address']=df_output_all['address'].str.lower()
    logging.info("Output data for year %s with %d records.", year, len(df_output_all))
    return df_output_all