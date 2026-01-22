import numpy as np
import pandas as pd
import re
import time
import requests
from concurrent.futures import ThreadPoolExecutor


def find_points_in_radius_tree(tree, df, input_lat, input_lon, radius_miles=1.0):
    EARTH_RADIUS_MILES = 3959
    # Convert radius to radians
    radius_radians = radius_miles / EARTH_RADIUS_MILES

    query_point = np.radians([[input_lat, input_lon]])  # shape (1,2)
    # Find indexes of points within radius
    idxs = tree.query_radius(query_point, r=radius_radians)
    # idxs is a list of arrays; for a single query, idxs[0] is an array of matching indices
    return df.iloc[idxs[0]]  # subset of your original DataFrame


def extract_address(address):
        #address=address.str.lower()
        street_suffix=['st','st.','ave','avenue','dr','cir','ct','ln','pl','rd','way','ter','blvd','pkwy','hwy','trl','cres','sq','plz','pass','run','loop','mnr','grn','gln','bnd','arc','al','ct','cswy','cyn','cpe','crse','crk','crst','xrd','p','t']
        address=address.replace('.','')
        address=address.replace(',','')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        address=address.replace('  ',' ')
        
        
        address = re.split(r'[ -]', address)
        if address[-1].isdigit():
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
    elif class_code == '299':
        return 'Condo'
    elif class_code in ['201','200','213','219','224','236','299']:
        return 'Residential Land, Coop, or Special Use'
    elif class_code in ['100','241']:
        return 'Vacant Lot'
    elif class_code in ['300','301','313','314','315','318','391','396','399']:
        return 'Multi-Family'
    elif class_code in ['500','501','516','517','522','523','526','526','528','529','530','531','532','533','535','590','591','592','597','599']:
        return 'Commercial'
    else:
        return 'Other'

def get_lat_lon_api(address, timeout=10, delay=0):
    """Get latitude and longitude for a given address using a local API."""
    url = f'http://localhost:8080/search.php?q={address}'
    response = requests.get(url, timeout=timeout, delay=delay)
    data = response.json()
    if data:
            return (data[0]['lat'], data[0]['lon'])
    else:
        return (None, None)

class LocalAddressLatLon:
    """Class to handle address to latitude/longitude lookup using a local API."""
    def __init__(self, address_series: pd.Series):
        self.address_series = address_series


    def get_lat_lon(self):
        addresses=self.address_series.tolist()
        n_workers = 10
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            futures = [executor.submit(self.__class__.get_lat_lon_api, addr) for addr in addresses] #use the classmethod

        results = [f.result() for f in futures]
        return zip(*results)
    
    def add_lat_lon_to_df(self, df: pd.DataFrame) -> pd.DataFrame:
        lat, lon = self.get_lat_lon()
        df['lat'] = lat
        df['lon'] = lon
        
        return df
    
    @classmethod
    def get_lat_lon_api(cls,address, timeout=10, delay=0):
        """
        Get latitude and longitude for a given address using a local API.
        """
        url = f'http://localhost:8080/search.php?q={address}'
        response = requests.get(url, timeout=timeout, delay=delay)
        data = response.json()
        if data:
                return (data[0]['lat'], data[0]['lon'])
        else:
            return (None, None)





