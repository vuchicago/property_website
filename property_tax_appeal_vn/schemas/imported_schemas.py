import pandas as pd

col_keep_parcels=['pin','tax_year','property_address','property_city','property_state','property_zip']
col_keep_assessed=['pin','tax_year','township_name','neighborhood_code','certified_bldg','certified_land','certified_tot']
col_keep_appeals=['pin','last_appeal_year','appeal_type','status','last_appeal_status','last_appeal_reason']
col_keep_characters=['pin','tax_year','card_num','class','township_code','pin_proration_rate','card_proration_rate','pin_is_multicard','pin_is_multiland',\
                    'year_built','building_sqft','num_bedrooms','num_rooms','num_full_baths','num_half_baths','type_of_residence','construction_quality',\
                    'num_apartments','garage_attached','garage_size','attic_type','basement_type','ext_wall_material','central_heating','repair_condition','basement_finish',\
                    'single_v_multi_family','site_desirability','num_commercial_units','renovation','recent_renovation','central_air','design_plan']
    
class ParcelSchema:
    """Schema for the Assessor data with data types"""
    schema = {
        'pin': int,
        'pin10': int,
        'tax_year': int,
        'property_address': str,
        'property_city': str,
        'property_state': str,
        'property_zip': int,
        'mailing_name': str,
        'mailing_address': str,
        'mailing_city': str,
        'mailing_state': str,
        'mailing_zip': int
    }
class PropDataDf(pd.DataFrame, ParcelSchema):
        pass        

class ParcelDataDf(pd.DataFrame, ParcelSchema):
    """DataFrame subclass for property data with schema validation"""
    pass


class AssessedDataDf(pd.DataFrame):
    """DataFrame subclass for assessed data with schema validation"""
    schema = {
        'pin': int,
        'tax_year': int,
        'township_name': str,
        'neighborhood_code': str,
        'certified_bldg': float,
        'certified_land': float,
        'certified_tot': float
    }
    pass

class AppealsDataDf(pd.DataFrame):
    """DataFrame subclass for appeals data with schema validation"""
    schema = {
        'pin': int,
        'last_appeal_year': int,
        'appeal_type': str,
        'status': str,
        'last_appeal_status': str,
        'last_appeal_reason': str
    }
    pass    

class PropertyCharacteristicsDataDf(pd.DataFrame):
    """DataFrame subclass for property characteristics data with schema validation"""
    schema = {
        'pin': int,
        'tax_year': int,
        'card_num': int,
        'class': str,
        'township_code': str,
        'pin_proration_rate': float,
        'card_proration_rate': float,
        'pin_is_multicard': bool,
        'pin_is_multiland': bool,
        'year_built': int,
        'building_sqft': float,
        'num_bedrooms': int,
        'num_rooms': int,
        'num_full_baths': int,
        'num_half_baths': int,
        'type_of_residence': str,
        'construction_quality': str,
        'num_apartments': int,
        'garage_attached': bool,
        'garage_size': float,
        'attic_type': str,
        'basement_type': str,
        'ext_wall_material': str,
        'central_heating': str,
        'repair_condition': str,
        'basement_finish': str,
        'single_v_multi_family': str,
        'site_desirability': str,
        'num_commercial_units': int,
        'renovation': str,
        'recent_renovation': str,
        'central_air': bool,
        'design_plan': str
    }
    pass