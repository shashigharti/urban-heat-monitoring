import os
import datetime
import glob
import subprocess
from dotenv import load_dotenv

load_dotenv()

data_folder = os.getenv("DATAPATH", "data")
tiles_level = os.getenv("TILES_LEVEL", "6-15")


def get_current_date():
    return datetime.datetime.now().strftime("%Y-%m-%d")


def generate_tiles_for_file(tif_file_path, tiles_folder_path):
    command = [
        "gdal2tiles.py",
        "-z",
        tiles_level,
        "-r",
        "bilinear",
        tif_file_path,
        tiles_folder_path,
    ]

    subprocess.run(command)
    print(f"Tiles generated for {tif_file_path} in {tiles_folder_path}")


def generate_tiles_for_city(city_folder):
    current_date = get_current_date()
    city_name = os.path.basename(city_folder)

    date_folder = os.path.join(city_folder, current_date)

    if not os.path.exists(date_folder):
        print(
            f"No folder found for the current date {current_date} in city folder {city_name}. Skipping..."
        )
        return

    for analysis_folder in glob.glob(os.path.join(date_folder, "*")):
        tif_files = glob.glob(os.path.join(analysis_folder, "image.tif"))

        if not tif_files:
            print(f"No image.tif file found in {analysis_folder}. Skipping...")
            continue

        for tif_file in tif_files:
            generate_tiles_for_file(tif_file, analysis_folder)


def main():
    for city_folder in glob.glob(os.path.join(data_folder, "*")):
        if os.path.isdir(city_folder):
            print(f"Generating tiles for city: {city_folder}")
            generate_tiles_for_city(city_folder)


if __name__ == "__main__":
    main()
