import ee
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')

ee.Authenticate()

project_name = os.getenv('PROJECT_NAME', 'ee-shashigharti')
ee.Initialize(project=project_name)

city_names = ['Riyadh']

# Process the aoi for the cities
# Change this to your own path
dest = os.getenv('BASE_DEST', 'users/shashigharti/data/processed/saudi/city_boundaries/')

threshold = 10

# Set date range
months = -6
end_date = ee.Date(datetime.now().strftime('%Y-%m-%d'))
start_date = end_date.advance(months, 'month')
total_days = end_date.difference(start_date, 'day')
num_weeks = total_days.divide(7).floor().getInfo()

# Generate list of weeks for past months specified by user
weeks = []
for i in range(num_weeks):
    start_week = start_date.advance(i * 7, 'day')
    end_week = start_week.advance(6, 'day')
    weeks.append({'start': start_week, 'end': end_week})

# Cloud mask function
def mask_s2_clouds(image):
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask).divide(10000)

# NDVI calculation
def calculate_ndvi(image):
    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    return image.addBands(ndvi)

# NDVI visualization parameters
ndvi_params = {
    'min': 0,  # Minimum NDVI value, typically representing non-vegetated areas
    'max': 1,  # Maximum NDVI value, representing dense vegetation
    'palette': ['blue', 'yellow', 'green']  # Color palette for NDVI visualization
    # blue -> low NDVI (e.g., water, barren land, or non-vegetated areas)
    # yellow -> mid-range NDVI (e.g., urban areas or mixed land cover)
    # green -> high NDVI (e.g., dense vegetation, forests, agricultural areas)
}

# Export NDVI to Drive
def export_ndvi(city_name):
    clean_name = city_name.replace(" ", "").lower()
    city_aoi = ee.FeatureCollection(f'{dest}{clean_name}')
    
    for week in weeks:
        week_start = ee.Date(week['start'])
        week_end = ee.Date(week['end'])

        dataset = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                   .filterBounds(city_aoi)
                   .filterDate(week_start, week_end)
                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                   .map(mask_s2_clouds))
        
        dataset_size = dataset.size().getInfo()
        if dataset_size == 0:
            print(f"No valid images for {clean_name} during week starting {week_start.format('YYYY-MM-dd').getInfo()}")
            continue

        ndvi = dataset.map(calculate_ndvi).mean().select('NDVI').clip(city_aoi)
        processed_date = week_start.format('YYYY-MM-dd').getInfo()
        file_name = f"{clean_name}_ndvi_{processed_date}"

        task = ee.batch.Export.image.toDrive(
            image=ndvi,
            description=file_name,
            scale=30,
            region=city_aoi.geometry(),
            fileFormat='GeoTIFF',
            folder='processed',
            maxPixels=1e8
        )
        task.start()
        print(f'Exporting {file_name} to Google Drive...')

# Add weekly NDVI layers to map (optional for geemap/folium)
def add_to_map(city_name):
    clean_name = city_name.replace(" ", "").lower()
    city_aoi = ee.FeatureCollection(f'{dest}{clean_name}')
    
    for week in weeks:
        week_start = ee.Date(week['start'])
        week_end = ee.Date(week['end'])
        
        dataset = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                   .filterBounds(city_aoi)
                   .filterDate(week_start, week_end)
                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                   .map(mask_s2_clouds))
        
        if dataset.size().getInfo() > 0:
            ndvi = dataset.map(calculate_ndvi).mean().select('NDVI').clip(city_aoi)
            week_label = week_start.format('YYYY-MM-dd').getInfo()
            # Uncomment below if using geemap or folium
            # Map.addLayer(ndvi, ndvi_params, f'{clean_name} NDVI {week_label}')
        else:
            print(f'No valid images for {clean_name} during week starting {week_start.format("YYYY-MM-dd").getInfo()}')

# Run for each city
for city in city_names:
    print(f'Processing {city}...')
    export_ndvi(city)