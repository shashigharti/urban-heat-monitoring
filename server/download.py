import os
import datetime
import argparse
from googleapiclient.discovery import build
from google.oauth2 import service_account
from dotenv import load_dotenv
import requests

load_dotenv()

# Google Drive API credentials in env file
credentials_path = os.getenv("GOOGLE_CREDENTIALS_PATH")
folder_id = os.getenv("FOLDER_ID")
data_folder = os.getenv("DATAPATH", "data")

if not credentials_path or not os.path.exists(credentials_path):
    raise Exception("Google credentials file path not found in environment variables.")

credentials = service_account.Credentials.from_service_account_file(
    credentials_path, scopes=["https://www.googleapis.com/auth/drive.readonly"]
)

service = build("drive", "v3", credentials=credentials)


def list_files_in_folder(folder_id):
    query = f"'{folder_id}' in parents"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    items = results.get("files", [])
    if not items:
        print("No files found.")
    else:
        return items


def get_current_date():
    return datetime.datetime.now().strftime("%Y-%m-%d")


def download_file(file_id, destination):
    download_url = f"https://drive.google.com/uc?id={file_id}"
    response = requests.get(download_url, stream=True)
    if response.status_code == 200:
        with open(destination, "wb") as f:
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)
        print(f"Downloaded file to {destination}")
    else:
        print(f"Failed to download the file. Status code: {response.status_code}")


def get_first_day_of_week_for_date(date):
    if isinstance(date, str):
        date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
    # weekday(): Monday = 0, Sunday = 6 → We want Sunday = 0
    sunday_index = (date.weekday() + 1) % 7
    return date - datetime.timedelta(days=sunday_index)


def download_and_process_files(analysis_type):
    current_date = get_current_date()
    files = list_files_in_folder(folder_id)
    if not os.path.exists(data_folder):
        os.makedirs(data_folder)

    for item in files:
        print(f"Processing file: {item['name']}")
        if analysis_type in item["name"]:
            # Enable if you want to process files for current date only
            # if current_date in item["name"]:
            file_id = item["id"]
            file_name = item["name"]
            parts = file_name.split("_")
            city = parts[0]
            analysis = parts[1]
            input_date = parts[2].split(".")[0]
            first_day_of_week = get_first_day_of_week_for_date(input_date)

            if analysis != analysis_type:
                continue
            city_folder = os.path.join(data_folder, city)

            if not os.path.exists(city_folder):
                os.makedirs(city_folder)
            first_day_of_week_str = first_day_of_week.strftime("%Y-%m-%d")
            date_folder = os.path.join(city_folder, first_day_of_week_str)

            if not os.path.exists(date_folder):
                os.makedirs(date_folder)

            analysis_folder = os.path.join(date_folder, analysis)
            if not os.path.exists(analysis_folder):
                os.makedirs(analysis_folder)

            destination = os.path.join(analysis_folder, f"image.tif")
            if os.path.exists(destination):
                print(f"File {destination} already exists. Skipping download.")
            else:
                download_file(file_id, destination)

            # Process json file
            destination = os.path.join(analysis_folder, f"stats.json")
            if os.path.exists(destination):
                print(f"File {destination} already exists. Skipping download.")
            else:
                download_file(file_id, destination)


def main():
    parser = argparse.ArgumentParser(
        description="Download and process files based on analysis type."
    )
    parser.add_argument(
        "--analysis",
        type=str,
        default="um",
        help="The analysis type to process (default 'um').",
    )
    args = parser.parse_args()
    analysis_types = ["um", "lst", "uhi", "ndvi", "ndbi", "albedo"]
    for analysis in analysis_types:
        download_and_process_files(analysis)


if __name__ == "__main__":
    main()
