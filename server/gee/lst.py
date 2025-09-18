import ee
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')

ee.Authenticate()

project_name = os.getenv('PROJECT_NAME', 'ee-shashigharti')
ee.Initialize(project=project_name)

city_names = ['Riyadh']  # Modify this for multiple cities

# Process the aoi for the cities
# Change this to your own path
dest = os.getenv('BASE_DEST', 'users/shashigharti/data/processed/saudi/city_boundaries/')

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

lst_vis_params = {
    'min': 0,
    'max': 50,
    'palette': ['blue', 'green', 'yellow', 'red']
}
uhi_vis_params = {
    'min': -5,
    'max': 5,
    'palette': ['blue', 'white', 'red']
}

weekly_intervals = [
    {'start': start_date.advance(i * 7, 'day'), 'end': start_date.advance(i * 7 + 6, 'day')}
    for i in range(num_weeks)
]

def mask_invalid_pixels(image):
    qa_mask = image.select('QA_PIXEL')
    cloud_mask = qa_mask.bitwise_and(1 << 5).eq(0)
    shadow_mask = qa_mask.bitwise_and(1 << 3).eq(0)
    return image.updateMask(cloud_mask.And(shadow_mask))

def calculate_lst(image):
    lst_celsius = image.select('ST_B10') \
        .multiply(0.00341802) \
        .add(149.0) \
        .subtract(273.15) \
        .rename('lst')
    return image.addBands(lst_celsius)

def get_urban_mask(city_name):
    clean_name = city_name.replace(" ", "").lower()
    city_boundary = ee.FeatureCollection(f'{dest}{clean_name}')
    viirs = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG") \
        .filterDate(start_date, end_date) \
        .filterBounds(city_boundary)
    mean_lights = viirs.select('avg_rad').mean()
    return mean_lights.gt(5).clip(city_boundary)

landsat_images = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2') \
    .filterDate(start_date, end_date) \
    .filterMetadata('CLOUD_COVER', 'less_than', 1) \
    .map(mask_invalid_pixels)

def export_lst_and_uhi(city_name, week_start, week_end):
    clean_name = city_name.replace(" ", "").lower()
    city_boundary = ee.FeatureCollection(f'{dest}{clean_name}')
    urban_mask = get_urban_mask(city_name)

    week_filter = ee.Filter.date(week_start, week_end)
    weekly_images = landsat_images.filter(week_filter).map(calculate_lst)

    if weekly_images.size().getInfo() <= 0:
        return

    lst_mean = weekly_images.select('lst').mean().clip(city_boundary)
    mask = lst_mean.mask()
    lst_mean = lst_mean.updateMask(mask)

    urban_lst = lst_mean.updateMask(urban_mask)
    urban_mean = urban_lst.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=city_boundary.geometry(),
        scale=30,
        maxPixels=1e13
    ).get('lst')
    urban_lst = urban_lst.unmask(ee.Number(urban_mean))

    nonurban_lst = lst_mean.updateMask(urban_mask.Not())
    nonurban_mean = nonurban_lst.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=city_boundary.geometry(),
        scale=30,
        maxPixels=1e13
    ).get('lst')
    nonurban_lst = nonurban_lst.unmask(ee.Number(nonurban_mean))

    uhi = urban_lst.subtract(nonurban_lst).clip(city_boundary)

    stats = {
        'lst_mean': lst_mean.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=city_boundary.geometry(),
            scale=30,
            maxPixels=1e13
        ).get('lst'),
        'uhi_index': uhi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=city_boundary.geometry(),
            scale=30,
            maxPixels=1e13
        ).get('lst')
    }

    # print(f"Mean values for {city_name}, week of {week_start.format('YYYY-MM-dd').getInfo()}:", stats)

    processed_date = week_start.format('YYYY-MM-dd').getInfo()
    file_name = f"{clean_name}_lst_{processed_date}"

    # ee.batch.Export.image.toDrive(**{
    #     'image': lst_mean,
    #     'description': file_name,
    #     'scale': 30,
    #     'region': city_boundary.geometry(),
    #     'fileFormat': 'GeoTIFF',
    #     'folder': 'processed',
    #     'maxPixels': 1e8
    # }).start()

    file_name = f"{clean_name}_uhi_{processed_date}"
    ee.batch.Export.image.toDrive(**{
        'image': uhi,
        'description': file_name,
        'scale': 30,
        'region': city_boundary.geometry(),
        'fileFormat': 'GeoTIFF',
        'folder': 'processed',
        'maxPixels': 1e8
    }).start()

    # file_name = f"{clean_name}_lst_{processed_date}"
    # ee.batch.Export.table.toDrive(**{
    #     'collection': ee.FeatureCollection([ee.Feature(city_boundary.geometry(), stats.get('lst_mean'))]),
    #     'description': file_name,
    #     'fileFormat': 'GeoJSON',
    #     'folder': 'processed',
    # }).start()

    file_name = f"{clean_name}_uhi_{processed_date}"
    ee.batch.Export.table.toDrive(**{
        'collection': ee.FeatureCollection([ee.Feature(city_boundary.geometry(), stats.get('uhi_index'))]),
        'description': file_name,
        'fileFormat': 'GeoJSON',
        'folder': 'processed',
    }).start()

for city in city_names:
    for interval in weekly_intervals:
        export_lst_and_uhi(city, interval['start'], interval['end'])
