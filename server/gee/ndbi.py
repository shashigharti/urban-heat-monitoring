import ee
# import geemap
from datetime import datetime

ee.Authenticate()
ee.Initialize(project='ee-shashigharti')

# Map = geemap.Map()

# List of cities
city_names = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif']
city_names = ['Riyadh']  # Modify this for multiple cities

# Process the aoi for the cities
# Change this to your own path
dest = 'users/shashigharti/data/processed/saudi/city_boundaries/'

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

# Function to mask clouds using Sentinel-2 QA band
def mask_s2_clouds(image):
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask).divide(10000)

# Function to calculate NDBI
def calculate_ndbi(image):
    ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI')
    return image.addBands(ndbi)

# NDBI Visualization Parameters
ndbi_params = {
    'min': 0,  # Minimum NDBI for urban areas
    'max': 1,  # Maximum NDBI for dense urban areas
    'palette': ['lightblue', 'yellow', 'darkred'],  # Try a more distinct palette
    # blue -> non-built-up areas (e.g., water, vegetation)
    # yellow -> semi-urban areas (e.g., mixed vegetation and buildings)
    # darkred -> built-up areas (dense urban areas)
}

# Function to export NDBI for each city for every week
def export_ndbi(city_name):
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

        ndbi = dataset.map(calculate_ndbi).mean().select('NDBI').clip(city_aoi)
        processed_date = week_start.format('YYYY-MM-dd').getInfo()
        file_name = f"{clean_name}_ndbi_{processed_date}"

        task = ee.batch.Export.image.toDrive(
            image=ndbi,
            description=file_name,
            scale=30,
            region=city_aoi.geometry(),
            fileFormat='GeoTIFF',
            folder='processed',
            maxPixels=1e8
        )
        task.start()
        print(f'Exporting {file_name} to Google Drive...')

# Function to add NDBI layers to the map for each city
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

        # Check if the collection is empty
        count = dataset.size().getInfo()
        if count > 0:
            ndbi = dataset.map(calculate_ndbi).mean().select('NDBI').clip(city_aoi)
            week_label = week_start.format('YYYY-MM-dd').getInfo()
            label = f"{clean_name} NDBI week {week_label}"
            # Add layer to map
            # Note: Earth Engine's map functionality will only work in the JS API, 
            # but in Python you can visualize it using Folium or other libraries
            print(f"Layer added: {label}")  # Placeholder for visualization
        else:
            print(f"No valid images for {clean_name} during week starting {week_start.format('YYYY-MM-dd').getInfo()}")

# Iterate over all cities
for city_name in city_names:
    print(f"Processing {city_name}...")
    export_ndbi(city_name)  # Uncomment to export
    # add_to_map(city_name)

# Example: Center the map on Riyadh (use a map library like Folium for visualization in Python)
# aoi = ee.FeatureCollection(f'{dest}riyadh')
# Map.centerObject(aoi, 10)  # Map functionality needs a library like Folium for visualization
