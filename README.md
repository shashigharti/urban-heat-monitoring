# FastAPI and React App

This project includes a FastAPI backend and a React frontend, with separate folders for each. Follow the steps below to run both services locally.

## Prerequisites

Before running the app, ensure you have the following installed:

- Python 3.8 or higher
- Node.js and npm (Node Package Manager)
- Git

You can download and install them from:

- [Python](https://www.python.org/downloads/)
- [Node.js](https://nodejs.org/)

## Installation

### Backend (FastAPI)

1. Clone this repository to your local machine:

    ```bash
    git clone https://github.com/yourusername/yourrepository.git
    cd yourrepository
    ```

2. Set up a virtual environment (recommended):

    ```bash
    python3 -m venv env
    source env/bin/activate  # On Windows, use `env\Scripts\activate`
    ```

3. Install the required Python dependencies:

    ```bash
    pip install -r requirements.txt
    ```

### Frontend (React)

1. Navigate to the `client` folder (or where your React app resides):

    ```bash
    cd client
    ```

2. Install the required Node.js dependencies:

    ```bash
    npm install
    ```

## Running the Backend (FastAPI)

1. Go back to the root directory of the project (where `server.py` is located):

    ```bash
    cd ..
    ```

2. Run the FastAPI server using Uvicorn:

    ```bash
    uvicorn server:app --reload
    ```

    This will start the backend server on `http://127.0.0.1:8000`. The `--reload` flag will automatically restart the server whenever you make changes to the code.

## Running the Frontend (React)

1. In a separate terminal window, go to the `client` folder (or where `index.jsx` is located):

    ```bash
    cd client
    ```

2. Start the React development server:

    ```bash
    npm start
    ```

    This will start the frontend server on `http://localhost:3000`. React will hot-reload changes as you develop.

## Accessing the Application

Once both servers are running:

- Access the FastAPI backend at `http://127.0.0.1:8000`.
- Access the React frontend at `http://localhost:3000`.

The frontend should be able to make API requests to the backend. Make sure you handle the backend API's URL in the React app accordingly (e.g., `http://127.0.0.1:8000/api/endpoint`).

## Environment Variables

If your app requires any environment variables (e.g., database credentials, secret keys), create a `.env` file in the root directory of the project.

For FastAPI, you can use `python-dotenv` to load environment variables in `server.py`. For React, you can define environment variables in a `.env` file inside the `client` folder (e.g., `REACT_APP_API_URL=http://127.0.0.1:8000`).

### Example `.env` file for FastAPI:
```plaintext
GOOGLE_CREDENTIALS_PATH=path_to_credentials.json
FOLDER_ID=your_folder_id
DATAPATH=data
