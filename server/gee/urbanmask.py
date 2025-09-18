import ee
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')

ee.Authenticate()

project_name = os.getenv('PROJECT_NAME', 'ee-shashigharti')
ee.Initialize(project=project_name)

city_names = ['Riyadh']
threshold = 10

# Process the aoi for the cities
# Change this to your own path
dest = os.getenv('BASE_DEST', 'users/shashigharti/data/processed/saudi/city_boundaries/')
months = -6

end_date = ee.Date(datetime.now())
start_date = end_date.advance(months, 'month')
total_days = end_date.difference(start_date, 'day')
num_weeks = int(total_days.getInfo() / 7)

weeks = []
for i in range(num_weeks):
    start = start_date.advance(i * 7, 'day')
    end = start.advance(6, 'day')
    weeks.append({'start': start, 'end': end})

viirs = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG").filterDate(start_date, end_date)

def export_urban_mask(city_name):
    clean_name = city_name.replace(" ", "").lower()
    city_boundary = ee.FeatureCollection(f'{dest}{clean_name}')
    
    for week in weeks:
        week_start = week['start']
        week_end = week['end']
        date_str = week_start.format('YYYY-MM-dd').getInfo()
        
        week_nightlights = viirs.filterDate(week_start, week_end).select('avg_rad').mean()
        urban_mask = week_nightlights.clip(city_boundary).gt(threshold)

        task = ee.batch.Export.image.toDrive(
            image=urban_mask,
            description=f'{clean_name}_um_{date_str}',
            folder='processed',
            fileNamePrefix=f'{clean_name}_um_{date_str}',
            scale=30,
            region=city_boundary.geometry(),
            fileFormat='GeoTIFF',
            maxPixels=1e8
        )
        
        task.start()
        print(f'Export started for {clean_name} - week of {date_str}')

for city in city_names:
    export_urban_mask(city)
