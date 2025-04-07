import ee

ee.Authenticate()
ee.Initialize(project='ee-shashigharti')

# Process the aoi for the cities
# Change this to your own path
dest = 'users/shashigharti/data/processed/saudi/city_boundaries/'
city_boundary = ee.FeatureCollection(f'{dest}riyadh')

# Example usage: Print number of features
print("Number of features:", city_boundary.size().getInfo())