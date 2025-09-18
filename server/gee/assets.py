import ee
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')

ee.Authenticate()

project_name = os.getenv('PROJECT_NAME', 'ee-shashigharti')
ee.Initialize(project=project_name)

# Process the aoi for the cities
# Change this to your own path
dest = os.getenv('BASE_DEST', 'users/shashigharti/data/processed/saudi/city_boundaries/')
city_boundary = ee.FeatureCollection(f'{dest}riyadh')

# Example usage: Print number of features
print("Number of features:", city_boundary.size().getInfo())