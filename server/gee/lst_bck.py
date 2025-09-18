import ee
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')

ee.Authenticate()

project_name = os.getenv('PROJECT_NAME', 'ee-shashigharti')
ee.Initialize(project=project_name)

# List of cities
city_names = ['Riyadh']  # Modify this for multiple cities

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

lst_params = {
    'min': 0,  # The minimum LST value, representing the coldest surfaces (e.g., water bodies, snow).
    'max': 50,  # The maximum LST value, representing the hottest surfaces (e.g., asphalt, urban areas).
    'palette': ['blue', 'green', 'yellow', 'red']  # Color palette for LST
    # blue -> Coldest areas (e.g., water bodies, snow).
    # green -> Cool areas (e.g., grasslands, forests).
    # yellow -> Warm areas (e.g., croplands, mixed urban areas).
    # red -> Hottest areas (e.g., urban heat islands, asphalt, rooftops).
}


def mask_invalid_pixels(image):
    qa_mask = image.select('QA_PIXEL')
    cloud_mask = qa_mask.bitwiseAnd(1 << 5).eq(0)
    shadow_mask = qa_mask.bitwiseAnd(1 << 3).eq(0)
    mask = cloud_mask.And(shadow_mask)
    return image.updateMask(mask)

def calculate_lst(image):
    lst_celsius = image.select('ST_B10').multiply(0.00341802).add(149.0).subtract(273.15).rename('lst')
    return image.addBands(lst_celsius)

def add_to_map(city_name):
    clean_name = city_name.replace(' ', '').lower()
    city_aoi = ee.FeatureCollection(f'{dest}{clean_name}')

    data = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2') \
        .filterBounds(city_aoi) \
        .filterDate(start_date, end_date) \
        .filterMetadata('CLOUD_COVER', 'less_than', 1) \
        .map(mask_invalid_pixels)

    for i, week in enumerate(weeks):
        week_start = ee.Date(week['start'])
        week_end = ee.Date(week['end'])
        week_filter = ee.Filter.date(week_start, week_end)
        weekly_images = data.map(calculate_lst).filter(week_filter)
        mask = weekly_images.select('lst').mean().mask()

        if weekly_images.size().getInfo() <= 0:
            print(f'Skipping Week {i + 1} for {city_name} (no images)')
            continue

        lst_mean = weekly_images.select('lst') \
            .mean() \
            .updateMask(mask) \
            .clip(city_aoi) \
            .set('week', f'Week {i + 1}')

        week_label = week_start.format('YYYY-MM-dd').getInfo()
        label = f'{city_name} LST Week {week_label}'

        # Assuming a map display function exists for your environment
        # Map.addLayer(lst_mean, lstParams, label)

def export_lst(city_name):
    clean_name = city_name.replace(' ', '').lower()
    city_aoi = ee.FeatureCollection(f'{dest}{clean_name}')

    data = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2') \
        .filterBounds(city_aoi) \
        .filterDate(start_date, end_date) \
        .filterMetadata('CLOUD_COVER', 'less_than', 1) \
        .map(mask_invalid_pixels)

    for i, week in enumerate(weeks):
        week_start = ee.Date(week['start'])
        week_end = ee.Date(week['end'])
        week_filter = ee.Filter.date(week_start, week_end)
        weekly_images = data.map(calculate_lst).filter(week_filter)
        mask = weekly_images.select('lst').mean().mask()

        if weekly_images.size().getInfo() <= 0:
            print(f'Skipping Week {i + 1} for {city_name} (no images)')
            continue

        lst_mean = weekly_images.select('lst') \
            .mean() \
            .updateMask(mask) \
            .clip(city_aoi) \
            .set('week', f'Week {i + 1}')

        processed_date = week_start.format('YYYY-MM-dd').getInfo()
        file_name = f"{clean_name}_lst_{processed_date}"

        # Export image to Google Drive
        task = ee.batch.Export.image.toDrive(
            image=lst_mean,
            description=file_name,
            scale=30,
            region=city_aoi.geometry(),
            fileFormat='GeoTIFF',
            folder='processed',
            maxPixels=1e8
        )
        task.start()

for city_name in city_names:
    export_lst(city_name)
