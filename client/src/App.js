import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { getListItemSecondaryActionClassesUtilityClass, Slider } from '@mui/material';
import moment from 'moment';
import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import parseGeoRaster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';
import axios from 'axios';

const ListComponent = ({ selectedOptions }) => {
  const palettes = {
    um: {
      name: "Urban Mask (UM)",
      items: [
        { id: 1, value: 1, description: 'Urban Area' },
        { id: 2, value: 0, description: 'Non-Urban Area' },
      ],
      color: (value) => (value === 1 ? 'green' : 'gray'),
    },
    lst: {
      name: "Land Surface Temperature (LST)",
      items: [
        { id: 1, value: 24, description: 'Cold (Water bodies)' },
        { id: 2, value: 34, description: 'Cool (Grassland)' },
        { id: 3, value: 39, description: 'Warm  (Cropland, Mixed urban)' },
        { id: 4, value: 50, description: 'Hot' },
      ],
      color: (value) => {
        if (value < 25) return 'blue';
        if (value < 35) return 'green';
        if (value < 40) return 'yellow';
        return 'red';
      },
    },
    albedo: {
      name: "Albedo",
      items: [
        { id: 1, value: 0.6, description: 'High Reflective Surface' },
        { id: 2, value: 0.2, description: 'Urban (Built up areas)' },
      ],
      color: (value) => (value > 0.3 ? 'white' : 'darkgray'),
    },
    ndvi: {
      name: "Normalized Difference Vegetation Index (NDVI)",
      items: [
        { id: 1, value: 0.8, description: 'Dense Vegetation' },
        { id: 2, value: 0.4, description: 'Sparse Vegetation' },
        { id: 3, value: 0.1, description: 'Barren Land' },
      ],
      color: (value) => {
        if (value >= 0.6) return 'darkgreen'; 
        if (value >= 0.2) return 'green';  
        return 'brown'; 
      },
    },
    ndbi: {
      name: "Normalized Difference Built-Up Index (NDBI)",
      items: [
        { id: 1, value: 0.1, description: 'Non-Built-Up Area' },
        { id: 2, value: 0.5, description: 'Semi-Urban Area' },
        { id: 3, value: 0.9, description: 'Built-Up Area' },
      ],
      color: (value) => {
        if (value < 0.3) return 'lightblue'; // Non-built-up areas
        if (value < 0.6) return 'yellow';    // Semi-urban areas
        return 'darkred'; // Built-up areas
      },
    },
    uhi: {
      name: "Urban Heat Island (UHI)",
      items: [
        { id: 1, value: -3, description: 'Cooler Area' },
        { id: 2, value: 0, description: 'Neutral Area' },
        { id: 3, value: 4, description: 'Hot Area' },
      ],
      color: (value) => {
        if (value < 0) return 'blue'; // Cooler areas
        if (value === 0) return 'white'; // Neutral areas
        return 'red'; // Hot areas
      },
    },
  };

  const palette = palettes[selectedOptions];
  if (!palette) return null;

  return (
    <div>
      <p>{palette.description}</p>
      <ul style={{ padding: '0', listStyleType: 'none' }}>
        {palette.items.map((item) => (
          <li
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px',              
            }}
          >
            <span style={
              {
                backgroundColor:palette.color(item.value),
                padding: '5px',
                marginRight: '10px',      
                border: '2px solid black',        
              }
              }>
            </span>
            <span>{item.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CityZoom = ({ selectedCity }) => {
  const map = useMap();
  useEffect(() => {
    const cityCoordinates = {
      riyadh: [24.7136, 46.6753],
      jiddah: [21.2854, 39.2376],
      dammam: [26.4207, 49.9777],
      makkahalmukarramah: [21.4225, 39.8262],
      alqatif: [26.8667, 49.9764],
    };
    
    const zoomLevel = 9;
    if (cityCoordinates[selectedCity]) {
      map.setView(cityCoordinates[selectedCity], zoomLevel);
    }
  }, [selectedCity, map]);

  return null;
};

function App() {
  const [selectedOptions, setSelectedOptions] = useState('um');
  const [selectedTime, setSelectedTime] = useState(0);
  const [selectedCity, setSelectedCity] = useState('riyadh');
  const [stats, setStats] = useState(null);
  const mapRef = useRef();

  const handleRadioChange = (event) => {
    setSelectedOptions(event.target.value);
  };

  const handleTimeChange = (event, newValue) => {
    setSelectedTime(newValue);
  };

  const handleCityChange = (event) => {
    setSelectedCity(event.target.value);
  };

  const getWeekDates = () => {
    let weeks = [];
    for (let i = 0; i < 26; i++) {
      const startOfWeek = moment().subtract(i, 'weeks').startOf('week');
      weeks.push(startOfWeek.format('YYYY-MM-DD'));
    }
    return weeks.reverse();
  };

  const weekDates = getWeekDates();

  useEffect(() => {
    const loadGeoTIFF = async () => {
      const palettes = {
        um: {
          name: "Urban Mask (UM)",
          description: "Green for urban areas, gray for non-urban areas.",
          color: (values) => {
            const value = values[0];
            if (value === undefined || isNaN(value)) return null;
      
            // Urban Mask (UM) - Green for urban areas, gray for non-urban
            return value === 1 ? 'green' : 'gray';
          },
        },
        lst: {
          name: "Land Surface Temperature (LST)",
          description: "Mapping temperature to colors.",
          color: (values) => {
            const value = values[0];
            if (value === undefined || isNaN(value)) return null;
      
            // LST ranges from low (cold) to high (hot) temperatures
            if (value < 25) return 'blue';  // Cold areas (e.g., water bodies, snow)
            if (value < 35) return 'green'; // Cool areas (e.g., grasslands, forests)
            if (value < 45) return 'yellow'; // Warm areas (e.g., croplands, mixed urban)
            return 'red'; // Hot areas (e.g., urban heat islands, asphalt)
          },
        },
        albedo: {
          name: "Albedo",
          description: "White for higher reflectivity, darkgray for lower reflectivity.",
          color: (values) => {
            const value = values[0];
            if (value === undefined || isNaN(value)) return null;
      
            // Albedo ranges from low (urban, asphalt) to high (snow, ice)
            return value > 0.3 ? 'white' : 'darkgray'; // High albedo (reflective surfaces) vs Low albedo (asphalt, urban)
          },
        },
        ndvi: {
          name: "Normalized Difference Vegetation Index (NDVI)",
          description: "Green for vegetation, brown for barren areas.",
          color: (values) => {
            const value = values[0];
            if (value === undefined || isNaN(value)) return null;
      
            // NDVI ranges from 0 to 1 (Non-vegetated areas to Dense vegetation)
            if (value >= 0.6) return 'darkgreen'; // Dense vegetation
            if (value >= 0.2) return 'green';    // Sparse vegetation
            return 'brown'; // Non-vegetated areas (barren or urban)
          },
        },
        ndbi: {
          name: "Normalized Difference Built-Up Index (NDBI)",
          description: "Blue for non-built-up areas, dark red for dense urban areas.",
          color: (values) => {
            const value = values[0];
            if (value === undefined || isNaN(value)) return null;
      
            // NDBI ranges from 0 to 1 (Non-built-up areas to Dense urban areas)
            if (value < 0.3) return 'lightblue';  // Non-built-up areas (e.g., water, vegetation)
            if (value < 0.6) return 'yellow';     // Semi-urban areas (mixed vegetation and buildings)
            return 'darkred';  // Built-up areas (dense urban)
          },
        },
        uhi: {
          name: "Urban Heat Island (UHI)",
          description: "Red for heat, blue for cooler areas.",
          color: (values) => {
            const value = values[0];
            if (value === undefined || isNaN(value)) return null;
      
            // UHI values range from negative to positive (Cooler to Hotter areas)
            if (value < 0) return 'blue'; // Cooler areas (negative UHI values)
            if (value === 0) return 'white'; // Neutral areas (no UHI difference)
            return 'red'; // Hotter urban areas (positive UHI values)
          },
        },
      };
      const selectedDate = weekDates[selectedTime];
      const tiffUrl = `http://localhost:8000/tiles/${selectedCity}/${selectedDate}/${selectedOptions}/image.tif`;

      try {
        const response = await fetch(tiffUrl);
        if (response.status === 200) {
          const arrayBuffer = await response.arrayBuffer();
          const georaster = await parseGeoRaster(arrayBuffer);
          const layer = new GeoRasterLayer({
            georaster: georaster,
            opacity: 0.9,
            resolution: 256,
            pixelValuesToColorFn: (palettes[selectedOptions].color),
          });

          if (mapRef.current) {
            layer.addTo(mapRef.current);
          }
        } else {
          console.warn(
            `GeoTIFF file not found for ${selectedCity}, ${selectedDate}, ${selectedOptions}`
          );
        }
      } catch (error) {
        console.error('Error loading GeoTIFF:', error);
      }
    };

    const fetchStats = async () => {
      try {
        const selectedDate = weekDates[selectedTime];
        const response = await axios.get(`/get-stats/${selectedCity}/${selectedDate}/${selectedOptions}`);
        if ('selectedOptions' in response.data) {
          setStats(response.data[selectedOptions]);
        }        
      } catch (err) {
        console.log('Error fetching stats:', err);
      }
    };
    
    loadGeoTIFF();
    fetchStats();

  }, [selectedTime, selectedOptions, selectedCity]);

  return (
    <div className="App">
      <h1 className="text-center my-4">KSA Urban Heat Island</h1>
      <div className="container-fluid">
        <div className="row">
          <div className="col-12 mb-4">
            <label htmlFor="citySelect" className="form-label me-2">
              <strong>Select City:</strong>
            </label>
            <select
              id="citySelect"
              className="form-select d-inline-block w-auto"
              value={selectedCity}
              onChange={handleCityChange}
            >
              <option value="riyadh">Riyadh</option>
              <option value="jiddah">Jiddah</option>
              <option value="alqatif">Alqatif</option>
              <option value="makkahalmukarramah">Mekkah</option>
            </select>
          </div>

          <div className="col-12 col-md-9">
            <div className="row">
              <div className="col-12" style={{ height: '70vh' }}>
                <MapContainer
                  center={[24.7136, 46.6753]}
                  zoom={7}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                  ref={mapRef}
                >
                  <CityZoom selectedCity={selectedCity} />

                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </MapContainer>
              </div>

              <div className="col-12" style={{ height: '15vh' }}>
                <Slider
                  value={selectedTime}
                  onChange={handleTimeChange}
                  min={0}
                  max={25}
                  step={1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) =>
                    moment(weekDates[value]).format('MMM D, YYYY')
                  }
                  aria-labelledby="time-slider"
                  marks={weekDates.map((date, index) => ({
                    value: index,
                    label: moment(date).format('MMM D, YYYY'),
                  }))}
                  sx={{
                    '& .MuiSlider-markLabel': {
                      fontSize: '11px',
                      transform: 'rotate(-45deg)',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      marginTop: '15px',
                    },
                  }}
                />
                <div className="mt-5 text-center">
                  <strong>Selected Week:</strong>{' '}
                  {moment(weekDates[selectedTime]).format('MMM D, YYYY')}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-3 p-3">
            <h3 className="my-4">Analysis</h3>
            <div className="analysis">
              {[
                { id: 'um', label: 'Urban Mask' },
                {
                  id: 'lst',
                  label: 'Land Surface Temperature',
                },
                { id: 'uhi', label: 'UHI (Urban Heat Island)' },
                { id: 'ndbi', label: 'NDBI' },
                { id: 'ndvi', label: 'NDVI' },
                { id: 'albedo', label: 'Albedo' },
              ].map(({ id, label }) => (
                <div className="form-check mb-2" key={id}>
                  <input
                    className="form-check-input"
                    type="radio"
                    id={id}
                    name="analysisOption"
                    value={id}
                    checked={selectedOptions === id}
                    onChange={handleRadioChange}
                  />
                  <label className="form-check-label" htmlFor={id}>
                    {label}
                  </label>
                </div>
              ))}
            </div>

            <div className="stats">
              <h3>Stats</h3>
              <ul className="list-group list-group-sm mb-3">
                <li className="list-group-item d-flex justify-content-between align-items-center px-2 py-1">
                  <span className="text-muted small">Mean</span>
                  <span className="small">{stats}</span>
                </li>
              </ul>
            </div>

            <div className="legend">
              <h3> Legend </h3>
              <ListComponent selectedOptions={selectedOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
