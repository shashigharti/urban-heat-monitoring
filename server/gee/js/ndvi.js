var cityNames = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif'];
cityNames = ['Riyadh']; // comment to run for all cities
var months = -6;

var endDate = ee.Date(Date.now());
var startDate = endDate.advance(months, 'month');
var totalDays = endDate.difference(startDate, 'day');
var numWeeks = totalDays.divide(7).floor();

var weeks = [];
for (var i = 0; i < numWeeks.getInfo(); i++) {
  var startWeek = startDate.advance(i * 7, 'day');
  var endWeek = startWeek.advance(6, 'day');
  weeks.push({start: startWeek, end: endWeek});
}

var dest = 'users/shashigharti/data/processed/saudi/city_boundaries/';

function maskS2Clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

function calculateNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

var ndviParams = {
  min: 0,  // Minimum NDVI value, typically representing non-vegetated areas
  max: 1,  // Maximum NDVI value, representing dense vegetation
  palette: ['blue', 'yellow', 'green'], // Updated color palette: 
  // blue -> low NDVI (e.g., water, barren land, or non-vegetated areas)
  // yellow -> mid-range NDVI (e.g., urban areas or mixed land cover)
  // green -> high NDVI (e.g., dense vegetation, forests, agricultural areas)
};

function exportNDVI(cityName) {
  var cleanName = cityName.replace(" ", "").toLowerCase();
  var cityAoi = ee.FeatureCollection(data + cleanName);

  weeks.forEach(function(week) {
    var weekStart = ee.Date(week.start);
    var weekEnd = ee.Date(week.end);

    var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                   .filterBounds(cityAoi)
                   .filterDate(weekStart, weekEnd)
                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                   .map(maskS2Clouds);
    
    var ndvi = dataset.map(calculateNDVI).mean().select('NDVI').clip(cityAoi);
    var processedDate = weekStart.format('YYYY-MM-dd').getInfo();
    var fileName = cleanName + '_ndvi_' + processedDate;
    
    Export.image.toDrive({
      image: ndvi,
      description: fileName,
      scale: 30,
      region: cityAoi.geometry(),
      fileFormat: 'GeoTIFF',
      folder: 'processed',
      maxPixels: 1e8
    });
  });
}

var hasNdviBand = function(image) {
  return image.bandNames().contains('NDVI');
};
function addToMap(cityName) {
  var cleanName = cityName.replace(" ", "").toLowerCase();
  var cityAoi = ee.FeatureCollection(dest + cleanName);

  weeks.forEach(function(week) {
    var weekStart = ee.Date(week.start);
    var weekEnd = ee.Date(week.end);

    var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(cityAoi)
      .filterDate(weekStart, weekEnd)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(maskS2Clouds);
    
    // Check if the collection is empty
    dataset.size().evaluate(function(count) {
      if (count > 0) {
        var ndvi = dataset.map(calculateNDVI).mean().select('NDVI').clip(cityAoi);
        var weekLabel = weekStart.format('YYYY-MM-dd').getInfo();
        Map.addLayer(ndvi, ndviParams, cleanName + ' NDVI ' + weekLabel);
      } else {
        print('No valid images for', cleanName, 'during week starting', weekStart.format('YYYY-MM-dd'));
      }
    });
  });
}

cityNames.forEach(function(cityName) {
  addToMap(cityName);
});

var aoi = ee.FeatureCollection(dest + 'riyadh');
Map.centerObject(aoi, 10);
