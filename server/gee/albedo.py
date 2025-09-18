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

albedo_params = {
    'min': 0,
    'max': 1,
    'palette': ['blue', 'green', 'yellow', 'red']  # Standard color palette for albedo
    # blue -> Non-built-up areas (e.g., water, vegetation) with low albedo values.
    # green -> Vegetated areas (e.g., croplands, grasslands) with moderate albedo values.
    # yellow -> Semi-urban areas (e.g., mixed vegetation and buildings) with higher albedo values.
    # red -> Urban areas (e.g., cities, roads, rooftops) with high albedo values.
}

def mask_s2_clouds(image):
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask).divide(10000)

# Reference for albedo calculation:
# Liu, Y., et al. (2020). "Satellite-based albedo estimation from Sentinel-2 and Landsat 8 data." Remote Sensing, 12(12), 1931.
# This study discusses the use of Sentinel-2 and Landsat 8 imagery for estimating albedo using weighted coefficients
# for reflectance bands (Blue, Green, Red, NIR, SWIR1, SWIR2). The coefficients used in the formula are based on
# empirical results from the paper
def calculate_albedo(image):
    blue = image.select('B2')
    green = image.select('B3')
    red = image.select('B4')
    nir = image.select('B8')
    swir1 = image.select('B11')
    swir2 = image.select('B12')

    albedo = (blue.multiply(0.279)
              .add(green.multiply(0.192))
              .add(red.multiply(0.119))
              .add(nir.multiply(0.093))
              .add(swir1.multiply(0.043))
              .add(swir2.multiply(0.017))
              .rename('Albedo')
    )
    return image.addBands(albedo)

def export_albedo(city_name):
    clean_name = city_name.replace(' ', '').lower()
    city_aoi = ee.FeatureCollection(f'{dest}{clean_name}')

    for week in weeks:
        week_start = ee.Date(week['start'])
        week_end = ee.Date(week['end'])

        dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(city_aoi) \
            .filterDate(week_start, week_end) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
            .map(mask_s2_clouds)

        dataset_size = dataset.size().getInfo()
        if dataset_size == 0:
            print(f"No valid images for {clean_name} during week starting {week_start.format('YYYY-MM-dd').getInfo()}")
            continue

        albedo = dataset.map(calculate_albedo).mean().select('Albedo').clip(city_aoi)
        processed_date = week_start.format('YYYY-MM-dd').getInfo()
        file_name = f"{clean_name}_albedo_{processed_date}"

        task = ee.batch.Export.image.toDrive(
            image=albedo,
            description=file_name,
            scale=30,
            region=city_aoi.geometry(),
            fileFormat='GeoTIFF',
            folder='processed',
            maxPixels=1e8
        )

        task.start()
        print(f'Exporting {file_name} to Google Drive...')

def add_to_map(city_name):
    clean_name = city_name.replace(' ', '').lower()
    city_aoi = ee.FeatureCollection(f'{dest}{clean_name}')

    for week in weeks:
        week_start = ee.Date(week['start'])
        week_end = ee.Date(week['end'])

        dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(city_aoi) \
            .filterDate(week_start, week_end) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
            .map(mask_s2_clouds)

        dataset_size = dataset.size().getInfo()
        if dataset_size == 0:
            print(f"No valid images for {clean_name} during week starting {week_start.format('YYYY-MM-dd').getInfo()}")
            continue

        albedo = dataset.map(calculate_albedo).mean().select('Albedo').clip(city_aoi)
        week_label = week_start.format('YYYY-MM-dd').getInfo()
        label = f"{clean_name} Albedo week {week_label}"

for city_name in city_names:
    print(f"Processing {city_name}...")
    export_albedo(city_name)
