var city_names = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif'];
city_names = ['Riyadh']; // comment to run for all cities

var dest = 'users/shashigharti/data/processed/saudi/city_boundaries/';
var months = -6;

var lstParams = {
  min: 0,   // The minimum LST value, representing the coldest surfaces (e.g., water bodies, snow).
  max: 50,  // The maximum LST value, representing the hottest surfaces (e.g., asphalt, urban areas).
  palette: ['blue', 'green', 'yellow', 'red']  // Standard color palette for LST
  // blue -> Coldest areas (e.g., water bodies, snow).
  // green -> Cool areas (e.g., grasslands, forests).
  // yellow -> Warm areas (e.g., croplands, mixed urban areas).
  // red -> Hottest areas (e.g., urban heat islands, asphalt, rooftops).
};

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

function mask_invalid_pixels(image) {
  var qa_mask = image.select('QA_PIXEL');
  var cloud_mask = qa_mask.bitwiseAnd(1 << 5).eq(0);
  var shadow_mask = qa_mask.bitwiseAnd(1 << 3).eq(0);
  var mask = cloud_mask.and(shadow_mask);
  return image.updateMask(mask);
}

function calculate_lst(image) {
  var lstcelsius = image.select('ST_B10')
    .multiply(0.00341802) // rescaling
    .add(149.0) // additive factor
    .subtract(273.15) // conversion
    .rename('lst');
  return image.addBands(lstcelsius);
}

function add_to_map(city_name) {
  var city_aoi = ee.FeatureCollection(dest + city_name.toLowerCase().replace(/\s+/g, ''));

  var data = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(city_aoi)
    .filterDate(startDate, endDate)
    .filterMetadata('CLOUD_COVER', 'less_than', 1)
    .map(mask_invalid_pixels);

  for (var i = 0; i < weeks.length; i++) {
    var week_start = ee.Date(weeks[i].start);
    var week_end = ee.Date(weeks[i].end);
  
    var week_filter = ee.Filter.date(week_start, week_end);
    var weekly_images = data.map(calculate_lst).filter(week_filter);
    var mask = weekly_images.select('lst').mean().mask();
    if (weekly_images.size().getInfo() <= 0) {
      print('Skipping Week ' + (i + 1) + ' for ' + city_name + ' (no images)');
      continue;
    }
  
    var lst_mean = weekly_images
      .select('lst')
      .mean()
      .updateMask(mask)
      .clip(city_aoi)
      .set('week', 'Week ' + (i + 1));
  
    var weekLabel = week_start.format('YYYY-MM-dd').getInfo();
    var label = city_name + ' LST Week ' + weekLabel;
  
    Map.addLayer(lst_mean, lstParams, label);
  }
}

function export_lst(city_name) {
  var cleanName = city_name.replace(/\s+/g, '_');
  var city_aoi = ee.FeatureCollection(dest + city_id);

  var data = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(city_aoi)
    .filterDate(startDate, endDate)
    .filterMetadata('CLOUD_COVER', 'less_than', 1)
    .map(mask_invalid_pixels)

  for (var i = 0; i < weeks.length; i++) {
    var week_start = ee.Date(weeks[i].start);
    var week_end = ee.Date(weeks[i].end);
  

    var week_filter = ee.Filter.date(week_start, week_end);
    var weekly_images = data.map(calculate_lst).filter(week_filter);
    var mask = weekly_images.select('lst').mean().mask();
    if (weekly_images.size().getInfo() <= 0) {
      print('Skipping Week ' + (i + 1) + ' for ' + city_name + ' (no images)');
      continue;
    }

    var lst_mean = weekly_images
      .select('lst')
      .mean()
      .updateMask(mask)
      .clip(city_aoi)
      .set('week', 'Week ' + (i + 1));

    var processedDate = weekStart.format('YYYY-MM-dd').getInfo();
    var fileName = cleanName + '_lst_' + processedDate;

    Export.image.toDrive({
      image: lst_mean,
      description: fileName,
      scale: 30,
      region: city_aoi.geometry(),
      fileFormat: 'GeoTIFF',
      folder: 'processed',
      maxPixels: 1e8
    });
  }
}

city_names.forEach(function(city_name) {
  add_to_map(city_name);
  // export_lst(city_name);
});

Map.centerObject(ee.FeatureCollection(dest + 'riyadh'), 10);
