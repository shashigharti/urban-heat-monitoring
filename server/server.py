import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import geojson

load_dotenv()

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
TILES_BASE_DIR = os.getenv("TILES_BASE_DIR", "data")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/tiles", StaticFiles(directory=TILES_BASE_DIR, html=False), name="tiles")

cities = {
    "riyadh": {"lat": 24.7136, "lng": 46.6753},
    "jiddah": {"lat": 21.2854, "lng": 39.2376},
    "mecca": {"lat": 21.4225, "lng": 39.8262},
    "dammam": {"lat": 26.4207, "lng": 49.9777},
}


@app.get("/get-analysis/{city}/{date}/{analysis}")
async def get_geotiff_tile(city: str, date: str, analysis: str):
    city = city.lower()

    if city not in zones:
        raise HTTPException(status_code=400, detail=f"Invalid city name: {city}")

    tiff_rel_path = os.path.join(city, date, analysis, "image.tif")
    tiff_abs_path = os.path.join(TILES_BASE_DIR, tiff_rel_path)

    if not os.path.exists(tiff_abs_path):
        raise HTTPException(status_code=404, detail="GeoTIFF tile not found.")

    return {"file_path": f"/tiles/{tiff_rel_path}"}

@app.get("/get-stats/{city}/{date}/{analysis}")
async def get_geotiff_stats(city: str, date: str, analysis: str):
    city = city.lower()

    if city not in cities:
        raise HTTPException(status_code=400, detail=f"Invalid city name: {city}")

    geojson_rel_path = os.path.join(city, date, analysis, "stats.geojson")
    geojson_abs_path = os.path.join(TILES_BASE_DIR, geojson_rel_path)

    if not os.path.exists(geojson_abs_path):
        raise HTTPException(status_code=404, detail="GeoJSON file not found.")

    with open(geojson_abs_path) as f:
        stats_data = geojson.load(f)

    stats = []

    for feature in stats_data['features']:
        if analysis in feature['properties']:
            stats.append(feature['properties'][analysis])
    
    if not stats:
        raise HTTPException(status_code=404, detail=f"No stats found for analysis: {analysis}")

    return {analysis: stats[0]}