
var dest = 'projects/ee-shashigharti/assets/saudi/city_boundaries/';
var aoi = ee.FeatureCollection(dest + "riyadh");

var lstParams = {
  min: 0,
  max: 50,
  palette: ['blue', 'green', 'yellow', 'red']
};

var lstParams = {
  min: 0,   // The minimum LST value, representing the coldest surfaces (e.g., water bodies, snow).
  max: 50,  // The maximum LST value, representing the hottest surfaces (e.g., asphalt, urban areas).
  palette: ['blue', 'green', 'yellow', 'red']  // Standard color palette for LST
  // blue -> Coldest areas (e.g., water bodies, snow).
  // green -> Cool areas (e.g., grasslands, forests).
  // yellow -> Warm areas (e.g., croplands, mixed urban areas).
  // red -> Hottest areas (e.g., urban heat islands, asphalt, rooftops).
};

var uhiVis = {
  min: -5,         // Minimum UHI value (cooler regions compared to their surroundings).
  max: 5,          // Maximum UHI value (hotter urban areas compared to their surroundings).
  palette: [
    'blue',        // Color for cooler areas (negative UHI values, e.g., vegetation or water bodies).
    'white',       // Color for neutral areas (UHI values close to zero, no significant difference).
    'red'          // Color for hotter areas (positive UHI values, indicating urban heat islands).
  ]
};
var city_names = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif'];
city_names = ['Riyadh'];

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


function mask_invalid_pixels(image) {
  var qa_mask = image.select('QA_PIXEL');
  var cloud_mask = qa_mask.bitwiseAnd(1 << 5).eq(0);
  var shadow_mask = qa_mask.bitwiseAnd(1 << 3).eq(0);
  var mask = cloud_mask.and(shadow_mask);
  return image.updateMask(mask);
}

function calculate_lst(image) {
  var lstcelsius = image.select('ST_B10')
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .rename('lst');
  return image.addBands(lstcelsius);
}

var getCityUrbanMask = function(city_name) {
  var cleanName = city_name.replace(/\s+/g, '').toLowerCase();
  var cityBoundary = ee.FeatureCollection(dest + cleanName);

  var cityViirs = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
                    .filterDate(startDate, endDate)
                    .filterBounds(cityBoundary);

  var meanNightLights = cityViirs.select('avg_rad').mean();
  var urbanMask = meanNightLights.gt(5).clip(cityBoundary);
  return urbanMask;
}

var images = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filterMetadata('CLOUD_COVER', 'less_than', 1)
    .map(mask_invalid_pixels);
  
function export_lst_uhi(city_name, week_start, week_end) {
  var cleanName = city_name.replace(/\s+/g, '').toLowerCase();
  var city_aoi = ee.FeatureCollection(dest + cleanName);
  var urbanMask = getCityUrbanMask(city_name);
  
  var week_filter = ee.Filter.date(week_start, week_end);
  var lst_images = images.map(calculate_lst).filter(week_filter);
  if (lst_images.size().getInfo() <= 0) {
    // print('No images found for ' + city_name + ' between ' + startDate.format('YYYY-MM-dd').getInfo() + ' and ' + endDate.format('YYYY-MM-dd').getInfo());
    return
  }
  // check_values(lst_images.select('lst').mean(), city_aoi,  startDate.format('YYYY-MM-dd').getInfo() + "lst_images");
  var mask = lst_images.select('lst').mean().mask();
  var lst_mean = lst_images.select('lst').mean().updateMask(mask).clip(city_aoi);
 

  var urban_lst_mean = lst_mean.select('lst').updateMask(urbanMask);
  var globalMean1 = urban_lst_mean.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: city_aoi.geometry(),
    scale: 30,
    maxPixels: 1e13
  }).get('lst');
  urban_lst_mean = urban_lst_mean.unmask(ee.Number(globalMean1));
  
  var non_urban_lst_mean = lst_mean.select('lst').updateMask(urbanMask.not());
  var globalMean2 = non_urban_lst_mean.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: city_aoi.geometry(),
    scale: 30,
    maxPixels: 1e13
  }).get('lst');
  non_urban_lst_mean = non_urban_lst_mean.unmask(ee.Number(globalMean2));
  
  var uhi_index = urban_lst_mean.subtract(non_urban_lst_mean).clip(city_aoi);

  var stats = {
    lst_mean: lst_mean.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: city_aoi.geometry(),
      scale: 30,
      maxPixels: 1e13
    }).get('lst'),
    uhi_index: uhi_index.reduceRegion({
    reducer: ee.Reducer.mean(),
      geometry: city_aoi.geometry(),
      scale: 30,
      maxPixels: 1e13
    }).get('lst')
  };
  print('Mean values:', stats);
  
  var processedDate = week_start.format('YYYY-MM-dd').getInfo();
  var fileName = cleanName + '_uhi_' + processedDate;

  Export.image.toDrive({
    image: uhi_index,
    description: fileName,
    scale: 30,
    region: city_aoi.geometry(),
    fileFormat: 'GeoTIFF',
    folder: 'processed',
    maxPixels: 1e8
  });
  
  fileName = cleanName + '_uhi_' + processedDate;
  Export.table.toDrive({
    collection: ee.FeatureCollection([ee.Feature(city_aoi.geometry(), stats.get('uhi_index'))]),
    description: fileName,
    fileFormat: 'GeoJSON',
    folder: 'processed',
  });
  
  fileName = cleanName + '_lst_' + processedDate;
  Export.image.toDrive({
    image: lst_mean,
    description: fileName,
    scale: 30,
    region: city_aoi.geometry(),
    fileFormat: 'GeoTIFF',
    folder: 'processed',
    maxPixels: 1e8
  });
  
  
  fileName = cleanName + '_lst_' + processedDate;
  Export.table.toDrive({
    collection: ee.FeatureCollection([ee.Feature(city_aoi.geometry(), stats.get('lst_mean'))]),
    description: fileName,
    fileFormat: 'GeoJSON',
    folder: 'processed',
  });
}


function add_to_map(city_name, week_start, week_end) {
  var cleanName = city_name.replace(/\s+/g, '').toLowerCase();
  var city_aoi = ee.FeatureCollection(dest + cleanName);
  var urbanMask = getCityUrbanMask(city_name);
  
  var week_filter = ee.Filter.date(week_start, week_end);
  var lst_images = images.map(calculate_lst).filter(week_filter);
  if (lst_images.size().getInfo() <= 0) {
    // print('No images found for ' + city_name + ' between ' + startDate.format('YYYY-MM-dd').getInfo() + ' and ' + endDate.format('YYYY-MM-dd').getInfo());
    return
  }
  // check_values(lst_images.select('lst').mean(), city_aoi,  startDate.format('YYYY-MM-dd').getInfo() + "lst_images");
  var mask = lst_images.select('lst').mean().mask();
  var lst_mean = lst_images.select('lst').mean().updateMask(mask).clip(city_aoi);
 

  var urban_lst_mean = lst_mean.select('lst').updateMask(urbanMask);
  var globalMean1 = urban_lst_mean.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: city_aoi.geometry(),
    scale: 30,
    maxPixels: 1e13
  }).get('lst');
  urban_lst_mean = urban_lst_mean.unmask(ee.Number(globalMean1));
  
  var non_urban_lst_mean = lst_mean.select('lst').updateMask(urbanMask.not());
  var globalMean2 = non_urban_lst_mean.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: city_aoi.geometry(),
    scale: 30,
    maxPixels: 1e13
  }).get('lst');
  non_urban_lst_mean = non_urban_lst_mean.unmask(ee.Number(globalMean2));
  
  var uhi_index = urban_lst_mean.subtract(non_urban_lst_mean).clip(city_aoi);
  var uhi_index_filtered = uhi_index.updateMask(uhi_index.neq(0));

  var stats = {
    lst_mean: lst_mean.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: city_aoi.geometry(),
      scale: 30,
      maxPixels: 1e13
    }).get('lst'),
    uhi_index: uhi_index_filtered.reduceRegion({
    reducer: ee.Reducer.mean(),
      geometry: city_aoi.geometry(),
      scale: 30,
      maxPixels: 1e13
    })
  };
  print('Mean values:', stats);
  
  var uhi_label = city_name + ' UHI' + startDate.format('YYYY-MM-dd').getInfo() + ' to ' + endDate.format('YYYY-MM-dd').getInfo();
  Map.addLayer(uhi_index_filtered, uhiVis, uhi_label);

  var lst_label = city_name + ' LST ' + startDate.format('YYYY-MM-dd').getInfo() + ' to ' + endDate.format('YYYY-MM-dd').getInfo();
  Map.addLayer(lst_mean, lstParams, lst_label);
}


city_names.forEach(function(city_name) {
  weeks.forEach(function(week) {
    var week_start = week.start;
    var week_end = week.end;
    export_lst_uhi(city_name, week_start, week_end);
    // add_to_map(city_name, week_start, week_end);
  });
});

Map.centerObject(aoi, 10);
