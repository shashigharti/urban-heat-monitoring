// Process boundaries for these cities.
var city_names = ['Riyadh', 'Jiddah', 'Makkah Al Mukarramah', 'Al Qatif'];
var assetPath = "projects/ee-shashigharti/assets/saudi/cities";
var cities = ee.FeatureCollection(assetPath);

city_names.forEach(function(city_name) {
  print(city_name);
  var selectedCity = cities.filter(ee.Filter.eq('NAME_2', city_name));
  print(selectedCity);
  
  Map.centerObject(selectedCity, 10); 
  Map.addLayer(selectedCity, {}, city_name + ' City');
  var formatted_city_name = city_name.toLowerCase().replace(/\s+/g, '');
  
  Export.table.toAsset({
    collection: selectedCity,
    description: formatted_city_name,
    assetId: 'saudi/city_boundaries/' + formatted_city_name
  });

});