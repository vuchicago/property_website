import re
import pandas as pd
from functools import cached_property
from property_tax.schemas.imported_schemas import ParcelSchema, PropDataDf, ParcelDataDf


# %%


        
class PropData:
    """Class to handle property data loading and filtering by year
    args:
        year (list): List of years to filter data on
    returns:
        DataFrames for appeals, assessed values, parcel addresses, and property characteristics filtered by year
    """
    def __init__(self, year:list):
        self.year: list = year
        self.files = {
            'appeals': 'Assessor_-_Appeals_20250117.csv',
            'prop_characters': 'Assessor_-_Single_and_Multi-Family_Improvement_Characteristics_20250117.csv',
            'parcel': 'Assessor_-_Parcel_Addresses_20250106.csv',
            'assessed': 'Assessor_-_Assessed_Values_20250116.csv'
        }

    def filter_csv_by_year(self, file_name):
        df=pd.read_csv(file_name)
        df=df[df['tax_year'].isin(self.year)]
        return df
    @cached_property
    def _appeals(self):
        return self.filter_csv_by_year(self.files['appeals'])

    @cached_property
    def _prop_characters(self):
        return self.filter_csv_by_year(self.files['prop_characters'])

    @cached_property
    def _parcel(self):
        return self.filter_csv_by_year(self.files['parcel'])

    @cached_property
    def _assessed(self):
        return self.filter_csv_by_year(self.files['assessed'])
    
    @cached_property
    def _appeals_all(self):
        return pd.read_csv(self.files['appeals'])
    
    def df_appeals(self):
        return pd.DataFrame(self._appeals)

    def df_prop_characters(self):
        return pd.DataFrame(self._prop_characters)

    def df_parcel(self):
        df = ParcelDataDf(self._parcel)
        df=df.loc[df['property_zip'].notnull(),:]
        df['address']=df['property_address']+' '+df['property_city']+' '+df['property_zip'].astype(int).astype(str)
        df['address']=df['address'].str.lower()
        return df

    def df_assessed(self):
        return pd.DataFrame(self._assessed)

    def df_appeals_all(self):
        """
        Returns the full appeals DataFrame without year filtering, sorted by pin and tax_year descending 
        """
        df=pd.DataFrame(self._appeals_all)
        df=df[df['tax_year']>2010]
        return df.sort_values(by=['pin','tax_year'],ascending=[True,False])
    

def extract_address(address):
    """Function to extract the main part of an address up to and including the street suffix"""
        #address=address.str.l14ower()
        ']\\\\\0.23\\\\\\\\\'\=['st','st.','ave','avenue','dr','cir','ct','ln','pl','rd','way','ter','blvd','pkwy','hwy','trl','cres','sq','plz','pass','run','loop','mnr','grn','gln','bnd','arc','al','ct','cswy','cyn','cpe','crse','crk','crst','xrd','p','t']
        address=address.replace('.','')
        address=address.replace(',','')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        
        
        address = re.split(r'[ -]', address) #this will split by space or hyphen
        if address[-1].isdigit(): #remove apartment number at end if exists
            address=address[:-1]        
        address=[x for x in address if x not in ['',' ']]
        #extract address starting with 0th element to last element up to and including street_suffix
        for i, _ in enumerate(address):
            if address[i].lower() in street_suffix:
                address=address[:i+1]
                address_condo=address[:i]
                break
        #address=[x for x in address if x not in ['st','ave','dr','cir','ct','ln','pl','rd','way']]

        address=' '.join(address)
        address_condo=' '.join(address_condo)
        return address,address_condo
    
def class_description(class_code):
    if class_code in ['202','203','204','205','206','207','208','209','210','211','212','234','278','295']:
        return 'Residential'
    elif class_code == '299': #check 299 for condo
        return 'Condo'
        
        
        
        
        
    elif class_code in ['201','2\00','213','219','224',
        return 'Residential Land, Coop, or Special Use'
    elif class_code in ['100','241']:
        return 'Vacant Lot'
    elif class_code in ['300','301','313','314','315','318','391','396','399']:
        return 'Multi-Family'
    elif class_code in ['500','501','516','517','522','523','526','526','528','529','530','531','532','533','535','590','591','592','597','599']:
        return 'Commercial'
    else:
        return 'Other'
    
