# GeoTIFF to Tile Conversion

This guide demonstrates how to convert a GeoTIFF file into map tiles using the `gdal2tiles.py` tool, which is part of the GDAL library. These tiles can be used for web mapping applications, such as Leaflet.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **GDAL** (Geospatial Data Abstraction Library)
  - If you don’t have GDAL installed, follow the installation instructions below.

## Installation

### Step 1: Install GDAL

#### Option 1: Install GDAL using APT (Ubuntu/Debian-based systems)

```bash
sudo apt-get update
sudo apt-get install gdal-bin
