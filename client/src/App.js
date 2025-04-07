import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Slider } from '@mui/material';
import moment from 'moment';
import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import parseGeoRaster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';

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
      const selectedDate = weekDates[selectedTime];
      const tiffUrl = `http://localhost:8000/tiles/${selectedCity}/${selectedDate}/${selectedOptions}/image.tif`;

      try {
        const response = await fetch(tiffUrl);
        if (response.status === 200) {
          const arrayBuffer = await response.arrayBuffer();
          const georaster = await parseGeoRaster(arrayBuffer);
          const layer = new GeoRasterLayer({
            georaster: georaster,
            opacity: 0.7,
            resolution: 256,
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

    loadGeoTIFF();
  }, [selectedTime, selectedOptions, selectedCity]);

  return (
    <div className="App">
      <h1 className="text-center my-4">Urban Heat Analysis</h1>
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
            <h3 className="text-center my-4">Analysis & Stats</h3>
            <div className="analysis">
              {[
                { id: 'um', label: 'Urban Mask' },
                {
                  id: 'landSurfaceTemperature',
                  label: 'Land Surface Temperature',
                },
                { id: 'urbanHeadIsland', label: 'UHI (Urban Heat Island)' },
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

            <div>
              <ul className="list-group list-group-sm mb-3">
                <li className="list-group-item d-flex justify-content-between align-items-center px-2 py-1">
                  <span className="text-muted small">Mean UHI</span>
                  <span className="small">2.3°C</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center px-2 py-1">
                  <span className="text-muted small">Mean LST</span>
                  <span className="small">35.7°C</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
