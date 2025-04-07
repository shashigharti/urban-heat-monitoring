var city_names = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif'];
// city_names = ['Riyadh']; // comment to run for all cities

var dest = 'users/shashigharti/data/processed/saudi/city_boundaries/';
var months = -6;

var albedoParams = {
  min: 0,   // The minimum albedo value, representing the darkest surfaces (e.g., asphalt, water bodies).
  max: 1,   // The maximum albedo value, representing the brightest surfaces (e.g., snow, ice, sand).
  palette: ['blue', 'green', 'yellow', 'red']  // Standard color palette for albedo
  // blue -> Non-built-up areas (e.g., water, vegetation) with low albedo values.
  // green -> Vegetated areas (e.g., croplands, grasslands) with moderate albedo values.
  // yellow -> Semi-urban areas (e.g., mixed vegetation and buildings) with higher albedo values.
  // red -> Urban areas (e.g., cities, roads, rooftops) with high albedo values.
};


function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

// Albedo calculation function (using common weighted coefficients)
/* Reference:
Liu, Y., et al. (2020). "Satellite-based albedo estimation from Sentinel-2 and Landsat 8 data." Remote Sensing, 12(12), 1931.
This study discusses the use of Sentinel-2 and Landsat 8 imagery for estimating albedo using weighted coefficients for reflectance bands (Blue, Green, Red, NIR, SWIR1, SWIR2).
The coefficients used in the formula are based on empirical results from the paper. */
function calculateAlbedo(image) {
  var blue = image.select('B2');    // Blue band
  var green = image.select('B3');   // Green band
  var red = image.select('B4');     // Red band
  var nir = image.select('B8');     // NIR band
  var swir1 = image.select('B11');  // SWIR1 band
  var swir2 = image.select('B12');  // SWIR2 band

  // Use weighted sum of reflectance bands for albedo calculation
  var albedo = blue.multiply(0.279)  // Blue band coefficient
                   .add(green.multiply(0.192))  // Green band coefficient
                   .add(red.multiply(0.119))  // Red band coefficient
                   .add(nir.multiply(0.093))  // NIR band coefficient
                   .add(swir1.multiply(0.043))  // SWIR1 band coefficient
                   .add(swir2.multiply(0.017))  // SWIR2 band coefficient
                   .rename('Albedo');
  return image.addBands(albedo);
}

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

function exportAlbedo(cityName) {
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

    var albedo = dataset.map(calculateAlbedo).mean().select('Albedo').clip(city_aoi);
    var processedDate = weekStart.format('YYYY-MM-dd').getInfo();
    var fileName = cleanName + '_albedo_' + processedDate;

    Export.image.toDrive({
      image: albedo,
      description: fileName,
      scale: 30,
      region: city_aoi.geometry(),
      fileFormat: 'GeoTIFF',
      folder: 'processed',
      maxPixels: 1e8
    });
  });
}

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

    dataset.size().evaluate(function(count) {
      if (count > 0) {
        var albedo = dataset.map(calculateAlbedo).mean().select('Albedo').clip(city_aoi);
        var weekLabel = weekStart.format('YYYY-MM-dd').getInfo();
        var label = cleanName + ' Albedo week ' + weekLabel;
        Map.addLayer(albedo, albedoParams, label);
      } else {
        print('No valid images for', cleanName, 'during week starting', weekStart.format('YYYY-MM-dd'));
      }
    });
  });
}

city_names.forEach(function(cityName) {
  // exportAlbedo(cityName);
  addToMap(cityName);
});

var aoi = ee.FeatureCollection(dest + 'riyadh');
Map.centerObject(aoi, 10);
