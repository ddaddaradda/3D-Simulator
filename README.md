# 3D Wheelchair Orientation Simulator

This project is a web-based 3D simulation tool designed to visualize and analyze wheelchair orientation data from Parquet files. It provides a user interface to select data from local files or an AWS S3 bucket, and it renders the orientation (pitch, roll, yaw) in a 3D environment using Three.js.

## Features

- **3D Visualization**: Renders wheelchair or motorcycle models in a 3D scene.
- **Data Sources**: Supports loading data from both local Parquet files and an AWS S3 bucket.
- **Playback Controls**: Includes play, pause, speed control, and a timeline slider for navigating through the simulation data.
- **Interactive Camera**: Offers both orbit controls and a free-camera mode for inspecting the 3D model from any angle.
- **Data Processing**: The backend processes Parquet files to calculate orientation data from raw sensor values.

## Technology Stack

- **Backend**:
  - **Framework**: Flask
  - **Libraries**: Pandas (for data manipulation), PyArrow (for Parquet files), Boto3 (for AWS S3 integration).
- **Frontend**:
  - **Library**: Three.js (for 3D rendering).
  - **Languages**: HTML, CSS, JavaScript (ESM).
- **Dependencies**: Managed with `uv` (see `pyproject.toml`).

## Project Structure

```
.
├── api/                  # Flask Blueprints for API routes
│   ├── local_api.py      # Routes for local file operations
│   └── s3_api.py         # Routes for S3 operations
├── data/                 # Default directory for local Parquet files
├── services/             # Business logic services
│   ├── s3_service.py     # Handles interaction with AWS S3
│   └── simulation_processor.py # Logic for processing Parquet data
├── static/               # Frontend assets
│   ├── js/               # Modular JavaScript files
│   │   ├── api.js
│   │   ├── simulation.js
│   │   └── ui.js
│   ├── main.js           # Main entry point for frontend JS
│   └── style.css         # Stylesheet
├── temp_data/            # Temporary storage for downloaded S3 files
├── api_server.py         # Main Flask application file
├── config.py             # Application configuration
├── index.html            # Main HTML file

└── pyproject.toml        # Project dependencies
```

## Setup and Running the Application

### Prerequisites

- Python 3.10 or higher.
- `uv` package manager (`pip install uv`).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd 2.wheelchair_analysis
    ```

2.  **Create a virtual environment and install dependencies:**
    ```bash
    uv venv
    uv pip install -r pyproject.toml 
    # Or if you have uv installed globally
    uv pip install -r pyproject.toml
    ```
    *Note: The dependencies are listed in `pyproject.toml`.*

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory by copying `.env.example`. If you plan to use the S3 functionality, you must have your AWS credentials configured in your environment (e.g., via `~/.aws/credentials` or by setting `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` in the `.env` file).

### Running the Server

To start the Flask development server, run:

```bash
python api_server.py
```

The application will be available at `http://localhost:7003`.
