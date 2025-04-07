var city_names = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif'];
// city_names = ['Riyadh']; // comment to run for all cities

var dest = 'users/shashigharti/data/processed/saudi/city_boundaries/';

// Dynamic week generation logic (same approach as for NDVI example)
var months = -6;  // Define the period of months for analysis (last 6 months)
var endDate = ee.Date(Date.now());  // Current date as end date
var startDate = endDate.advance(months, 'month');  // Calculate start date by subtracting 6 months
var totalDays = endDate.difference(startDate, 'day');
var numWeeks = totalDays.divide(7).floor();

var weeks = [];
for (var i = 0; i < numWeeks.getInfo(); i++) {
  var startWeek = startDate.advance(i * 7, 'day');
  var endWeek = startWeek.advance(6, 'day');
  weeks.push({start: startWeek, end: endWeek});
}

// Function to mask clouds using Sentinel-2 QA band
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

// Function to calculate NDBI
function calculateNDBI(image) {
  var ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI');
  return image.addBands(ndbi);
}


// NDBI Visualization Parameters
var ndbiParams = {
  min: 0,       // Minimum NDBI for urban areas
  max: 1,       // Maximum NDBI for dense urban areas
  palette: ['lightblue', 'yellow', 'darkred'],  // Try a more distinct palette
  // blue -> non-built-up areas (e.g., water, vegetation)
  // yellow -> semi-urban areas (e.g., mixed vegetation and buildings)
  // darkred -> built-up areas (dense urban areas)
};


// Export NDBI for each city for every week
function exportNDBI(cityName) {
  var cleanName = cityName.replace(/\s+/g, '').toLowerCase();
  var city_aoi = ee.FeatureCollection(dest + cleanName);

  weeks.forEach(function(week) {
    var weekStart = ee.Date(week.start);
    var weekEnd = ee.Date(week.end);

    var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                   .filterBounds(city_aoi)
                   .filterDate(weekStart, weekEnd)
                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                   .map(maskS2clouds);
    
    var ndbi = dataset.map(calculateNDBI).mean().select('NDBI').clip(city_aoi);
    var processedDate = weekStart.format('YYYY-MM-dd').getInfo();
    var fileName = cleanName + '_ndbi_' + processedDate;
    
    Export.image.toDrive({
      image: ndbi,
      description: fileName,
      scale: 30,
      region: city_aoi.geometry(),
      fileFormat: 'GeoTIFF',
      folder: 'processed',
      maxPixels: 1e8
    });
  });
}

// Add NDBI layers to the map for each city
function addToMap(cityName) {
  var cleanName = cityName.replace(/\s+/g, '').toLowerCase();
  var city_aoi = ee.FeatureCollection(dest + cleanName);

  weeks.forEach(function(week) {
    var weekStart = ee.Date(week.start);
    var weekEnd = ee.Date(week.end);

    var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(city_aoi)
      .filterDate(weekStart, weekEnd)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(maskS2clouds);

    // Check if the collection is empty
    dataset.size().evaluate(function(count) {
      if (count > 0) {
        var ndbi = dataset.map(calculateNDBI).mean().select('NDBI').clip(city_aoi);
        var weekLabel = weekStart.format('YYYY-MM-dd').getInfo();
        var label = cleanName + ' NDBI week ' + weekLabel;
        Map.addLayer(ndbi, ndbiParams, label);
      } else {
        print('No valid images for', cleanName, 'during week starting', weekStart.format('YYYY-MM-dd'));
      }
    });
  });
}

// Iterate over all cities
city_names.forEach(function(cityName) {
  // exportNDBI(cityName);
  addToMap(cityName);
});

var aoi = ee.FeatureCollection(dest + 'riyadh');
Map.centerObject(aoi, 10);
