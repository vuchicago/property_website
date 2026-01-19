import pandas as pd
import numpy as np
import plotly.express as px
from datetime import datetime
from sklearn.neighbors import BallTree
from address_lookup import find_points_in_radius_tree
import logging
import seaborn as sns
import matplotlib.pyplot as plt

from functools import lru_cache as lrucache
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
class PropertyMatch:

        def __init__(self, input_dataset: pd.DataFrame, address: str="8141 Tripp ave Skokie", radius:float=0.5):
                self._input_dataset = input_dataset  # Private attribute
                self.address = address
                self.radius =radius
        
        #def __repr__(self):
                #return f'ShinyROI(loan_amt={self.loan_amt}, ir={self.ir}, loan_months={self.loan_months}, additional_principal={self.additional_principal},additional_principal_months={self.additional_principal_months})'
        def update_matches(self, address, radius=0.5):
                self.address=address
                self.radius=radius
       

        def match_properties(self):
                start=datetime.now()
                df=self._input_dataset.copy()
                df_input_select=df.loc[df['Nearby Address'].str.contains(self.address,case=False),:]
                pin=df_input_select.index.values[0]
                lat,lon=df_input_select.loc[df_input_select.index==pin,['lat','lon']].values[0]

                class_code=df_input_select['class'].values[0]

                neighborhood=df_input_select.loc[:,'Neighborhood Code'].values[0]

                ####conditions for filtering


                if class_code in ['202','203','204','205','206','207','208','209','210','211','212','218','219','234','278','295']:
                        home_size=df_input_select.loc[:,'Home Size'].values[0]
                        lot_size=df_input_select.loc[:,'Certified Land'].values[0]
                        bedroom_count=df_input_select.loc[:,'Bedroom Count'].values[0]
                        #df_input_select.loc[:, 'bathroom_count']=df_input_select['num_full_baths']+df_input_select['num_half_baths']
                        bathroom_count=df_input_select.loc[:,'Bathroom Count'].values[0]
                        home_size_min,home_size_max=home_size*.9,home_size*1.15
                        lot_size_min,lot_size_max=lot_size*.8,lot_size*1.2
                        bedroom_min,bedroom_max=bedroom_count,bedroom_count+1
                        bathroom_min,bathroom_max=bathroom_count,bathroom_count+1
                        masonry_type=df_input_select.loc[:,'Masonry Type'].values[0]
                #     basement_finish=df_input_select.loc[:,'basement_finish'].values[0]
                        pin_proration_rate=df_input_select.loc[:,'PIN Proration Rate'].values[0]      
                        single_vs_multi_family=df_input_select.loc[:,'Single vs Multi Family'].values[0]
                        df=df.loc[(df['Neighborhood Code']==neighborhood) & 
                        (df['class']==class_code) &
                        (df['Home Size']>=home_size_min) &
                        #(df['Taxable Value']<=home_size_max) &
                        (df['Certified Land']>=lot_size_min) & (df['Certified Land']<=lot_size_max) &
                        (df['Bedroom Count']>=bedroom_min) & (df['Bedroom Count']<=bedroom_max) &
                        (df['Bathroom Count']>=bathroom_min) & (df['Bathroom Count']<=bathroom_max) &
                        (df['Masonry Type']==masonry_type) &
                        (df['Single vs Multi Family']==single_vs_multi_family) &
                        (df['PIN Proration Rate']==pin_proration_rate),:]
                        logging.info(f"Filtered dataset size after applying conditions: {df.shape}")
                elif class_code =='EX':
                        df[df['Nearby Address']=='No Matches in Radius']# rework this
                elif class_code in ['100','241'] and pd.notna(df_input_select['Home Size'].values[0]): ##TODO fix this
                        home_size=df_input_select.loc[:,'Home Size'].values[0]
                        ###exempt is like churches and stuff it doesn't matter
                        df=df.loc[(df['Neighborhood Code']==neighborhood)&
                        (df['class']==class_code) ,:]
                                             
                else:# class_code in ['299','517','590','593','201','315','597','580']: ##do handling for condos, 1 story commercial',commercial minor improvement, industrial building,201=residential garage
                        home_size=df_input_select.loc[:,'Taxable Value'].values[0]
                        lot_size=df_input_select.loc[:,'Certified Land'].values[0]
                        home_size_min,home_size_max=home_size*.9,home_size*1.15
                        lot_size_min,lot_size_max=lot_size*.8,lot_size*1.2
                        df=df.loc[(df['Neighborhood Code']==neighborhood) &
                        (df['class']==class_code) &
                        (df['Certified Land']>=lot_size_min) & (df['Certified Land']<=lot_size_max)&
                        (df['Taxable Value']>=home_size_min) &
                        (df['Taxable Value']<=home_size_max),:] 
                   


                logging.info(f'Number of rows remaining after filtering: {df.shape[0]}')
                if df.shape[0]==0:
                        logging.info('No Matches in Radius')
                        return df[df['Nearby Address']=='No Matches in Radius']
                else:
                        coords_radians = np.radians(df.loc[:,['lat', 'lon']].values)
                        tree = BallTree(coords_radians, metric='haversine')
                        df_matches=find_points_in_radius_tree(tree, df, lat,lon, radius_miles=self.radius)
        

                        col_keep_new=['Nearby Address','Taxable Value','Last Appeal Year','Certified Land','Certified Building','Home Size',
                                'Last Appeal Status','Bedroom Count','Bathroom Count','Masonry Type','Finished Basement',
                                'Single vs Multi Family','Neighborhood Code','Garage Size','Class Description','PIN Proration Rate','pin','lat','lon','class']
                        end=datetime.now()
                        logging.info(f'Time taken to match properties: {end-start}')
                        return pd.DataFrame(df_matches[col_keep_new])

        # def output_shiny(self, results):
        #         # Get matched properties and other details
        #         df = self._input_dataset
        #         if results.shape[0] == 0:
        #                 return "No Matches Found in Radius"
        #         else:
        #     # Calculate values
        #                 avg_valuation = results['Taxable Value'].mean()
        #                 my_valuation = df.loc[df['Nearby Address'].str.contains(self.address, case=False), 'Taxable Value'].values[0]

        #                 # Create a new DataFrame with avg_valuation and my_valuation
        #                 data = {
        #                         'Category': ['My Taxable Value', 'Avg Comps Taxable Value'],
        #                         'Valuation': [my_valuation, avg_valuation]
        #                 }
        #                 df_plot = pd.DataFrame(data)

        #                 # Create the bar chart using Seaborn
        #                 fig, ax = plt.subplots(figsize=(10, 6))
        #                 bar_plot = sns.barplot(x='Category', y='Valuation', data=df_plot, palette='viridis', ax=ax)
        #                 bar_plot.set_title('My Taxable Value vs Avg Comps Taxable Value')
        #                 bar_plot.set_ylabel('Taxable Valuation $')
        #                 bar_plot.set_xlabel('Category')

        #                 # Add values on top of the bars
        #                 for index, value in enumerate(df_plot['Valuation']):
        #                         bar_plot.text(index, value, f'${value:,.0f}', color='black', ha="center")

        #                 # Adjust the legend


        #                 # Return the figure object
        #                 return fig


        def output_shiny_sidebar(self, results):
        # Get matched properties and other details
                df = self._input_dataset
                if results.shape[0] == 0:
                        return "No Matches Found in Radius"
                else:
                        # Calculate values
                        avg_valuation = results['Taxable Value'].mean()
                        my_valuation = df.loc[df['Nearby Address'].str.contains(self.address, case=False), 'Taxable Value'].values[0]

                        # Create a new DataFrame with avg_valuation and my_valuation
                        data = {
                        'Properties': ['Mine', 'Comps'],
                        'Taxable Valuation': [my_valuation, avg_valuation]
                        }
                        df_plot = pd.DataFrame(data)

                        # Create the bar chart using Seaborn with a custom palette
                        fig, ax = plt.subplots(figsize=(4, 5))
                        palette = ['#007BFF', '#FF4136']  # Bright blue and bright red
                        sns.barplot(
                        x='Properties',
                        y='Taxable Valuation',
                        hue='Properties',
                        data=df_plot,
                        palette=palette,
                        ax=ax,
                        legend=False
                        )
                        ax.set_title('Taxable Valuations', fontsize=14)
                        # Optionally, format the y-axis for currency
                        ax.set_ylabel('Taxable Valuation ($)', fontsize=12)
                        ax.ticklabel_format(style='plain', axis='y')
                        # Add values on top of the bars
                        for index, value in enumerate(df_plot['Taxable Valuation']):
                                ax.text(index, value, f'${value:,.0f}', color='black', ha="center")
                        return fig


        def output_shiny(self, results):
                # Get matched properties and other details
                df = self._input_dataset
                if results.shape[0]==0:
                        return "No Matches Found in Radius"
                else:
                        # Calculate values
                        avg_valuation = results['Taxable Value'].mean()
                        my_valuation = df.loc[df['Nearby Address'].str.contains(self.address, case=False), 'Taxable Value'].values[0]

                        # Create a new DataFrame with avg_valuation, my_valuation, and median_valuation
                        data = {
                                'Category': ['Valuation', 'Valuation'],
                                'Type': ['My Taxable Value', 'Avg Comps Taxable Value'],
                                'Valuation': [my_valuation, avg_valuation]
                        }
                        df = pd.DataFrame(data)

                        # Create the bar chart
                        fig = px.bar(
                                df,
                                x='Type',
                                y='Valuation',
                                color='Type',
                                #title='Taxable Valuations',
                                labels={'Valuation': 'Taxable Valuation $'}
                        )

                        # Update layout to ensure bars are rendered correctly
                        fig.update_layout(
                                yaxis=dict(title='County Taxable Valuation $'),
                                xaxis=dict(title='Comparable Type'),
                                showlegend=False
                        )

                        return fig