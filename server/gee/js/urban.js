// Visualization parameters for the urban mask
// var urbanMaskParams = {
//   min: 0,  // The minimum value for the urban mask. Represents rural areas with no or low nighttime lights (black color).
//   max: 1,  // The maximum value for the urban mask. Represents urban areas with high nighttime lights (yellow color).
//   palette: ['black', 'yellow']  // Color palette for visualizing rural and urban areas
// };

var city_names = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif'];
city_names = ['Riyadh'] // comment to run for all cities
var dest = 'users/shashigharti/data/processed/saudi/city_boundaries/';

var months = -6;
var endDate = ee.Date(Date.now());
print('End Date:', endDate);

var startDate = endDate.advance(months, 'month');
print('Start Date (' + Math.abs(months) + ' months ago):', startDate);

var totalDays = endDate.difference(startDate, 'day');
print('Total Days:', totalDays);

var numWeeks = totalDays.divide(7).floor();
print('Number of Weeks:', numWeeks);

var weeks = [];
for (var i = 0; i < numWeeks.getInfo(); i++) {
  var startWeek = startDate.advance(i * 7, 'day');
  var endWeek = startWeek.advance(6, 'day');
  weeks.push({start: startWeek, end: endWeek});
}

print('Weekly Date Ranges:', weeks);

var viirs = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
              .filterDate(startDate, endDate);
// Define a threshold for urban areas (value greater than 10 indicates urban areas)
var threshold = 10;

var exportUrbanMask = function(city_name) {
  var cleanName = city_name.replace(/\s+/g, '').toLowerCase();
  var cityBoundary = ee.FeatureCollection(dest + cleanName);

  weeks.forEach(function(week, i) {
    var weekStart = ee.Date(week.start);
    var weekEnd = ee.Date(week.end);
    print(weekStart)
    
    var weekNightLights = viirs.filterDate(weekStart, weekEnd).select('avg_rad').mean();
    var urbanMask = weekNightLights.clip(cityBoundary).gt(threshold);
    
    var processedDate = weekStart.format('YYYY-MM-dd').getInfo();
    var fileName = cleanName + '_um_' + processedDate;
    
    Export.image.toDrive({
      image: urbanMask,
      description: fileName
      scale: 30,
      region: cityBoundary,
      fileFormat: 'GeoTIFF',
      folder: 'processed',
      maxPixels: 1e8
    });
    print('Export started for ' + cleanName + ' - ' + fileName);
  });
};

exportUrbanMask('Jiddah');
