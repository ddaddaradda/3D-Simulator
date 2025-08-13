
import pandas as pd
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
from datetime import datetime
import logging
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from simulation_processor import process_parquet_file
from services.s3_service import S3Service

"""
Flask API server for wheelchair orientation simulation.
"""

# --- Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_FOLDER = os.path.join(APP_ROOT, 'static')
DATA_FOLDER = os.path.join(APP_ROOT, 'data')
TEMP_FOLDER = os.path.join(APP_ROOT, 'temp_data')

app = Flask(__name__, static_folder=STATIC_FOLDER)
CORS(app)
s3_service = S3Service()

# --- Helper Functions ---
def _list_parquet_files() -> List[Dict[str, Any]]:
    """Return a list of parquet files in DATA_FOLDER with metadata."""
    if not os.path.isdir(DATA_FOLDER):
        logging.warning(f"Data folder not found at: {DATA_FOLDER}")
        return []
    
    files: List[Dict[str, Any]] = []
    for name in os.listdir(DATA_FOLDER):
        if not name.lower().endswith('.parquet'):
            continue
        path = os.path.join(DATA_FOLDER, name)
        try:
            stat = os.stat(path)
            files.append({
                'name': name,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
        except OSError as e:
            logging.error(f"Could not stat file {path}: {e}")
            continue
            
    files.sort(key=lambda f: f['modified'], reverse=True)
    return files

def _safe_data_path(filename: str) -> Optional[str]:
    """Resolve a filename to an absolute path inside DATA_FOLDER; return None if invalid."""
    if not filename:
        return None
    
    data_root = os.path.abspath(DATA_FOLDER)
    candidate = os.path.abspath(os.path.join(data_root, filename))
    
    if not candidate.startswith(data_root + os.sep):
        logging.warning(f"Path traversal attempt detected: {filename}")
        return None
    if not os.path.isfile(candidate):
        return None
    if not candidate.lower().endswith('.parquet'):
        logging.warning(f"Invalid file type requested: {filename}")
        return None
        
    return candidate

# --- API Endpoints ---
@app.route('/api/files')
def list_files():
    """List available parquet files under the data folder."""
    try:
        files = _list_parquet_files()
        return jsonify({'files': files})
    except Exception as e:
        logging.error(f"Error listing files: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred while listing files.'}), 500

@app.route('/api/local/delete', methods=['POST'])
def delete_local_file():
    data = request.get_json()
    filename = (data or {}).get('file')
    if not filename:
        return jsonify({'error': 'Missing file'}), 400
    safe_path = _safe_data_path(filename)
    if not safe_path:
        return jsonify({'error': 'Invalid file'}), 400
    try:
        os.remove(safe_path)
        return jsonify({'message': 'Deleted'})
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        logging.error(f"Failed to delete file {safe_path}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to delete file'}), 500

@app.route('/api/data')
def get_simulation_data():
    """Return simulation data for a selected file (or newest if missing)."""
    filename = request.args.get('file')
    file_path: Optional[str] = None

    if filename:
        file_path = _safe_data_path(filename)
        if file_path is None:
            return jsonify({'error': f"Invalid or unsafe file parameter: {filename}"}), 400
    else:
        files = _list_parquet_files()
        if not files:
            return jsonify({'error': 'No parquet files found in data folder.'}), 404
        
        file_path = _safe_data_path(files[0]['name'])
        if file_path is None:
            logging.error(f"Could not resolve a safe path for the newest file: {files[0]['name']}")
            return jsonify({'error': 'Could not resolve data file.'}), 500

    try:
        logging.info(f"Processing data for file: {os.path.basename(file_path)}")
        payload = process_parquet_file(file_path)
        return jsonify(payload)
    except FileNotFoundError:
        logging.warning(f"File not found: {file_path}")
        return jsonify({'error': 'File not found.'}), 404
    except pd.errors.ParserError as e:
        logging.error(f"Failed to parse Parquet file {file_path}: {e}")
        return jsonify({'error': 'Failed to parse the data file.'}), 500
    except Exception as e:
        logging.error(f"Failed to process file {file_path}: {e}", exc_info=True)
        return jsonify({'error': f'An unexpected error occurred while processing the file.'}), 500

# --- S3 Endpoints ---
@app.route('/api/s3/sensors')
def list_s3_sensors():
    """Lists available sensor files from S3 for a given type and date."""
    sensor_type = request.args.get('type')
    date_str = request.args.get('date')

    if not sensor_type or not date_str:
        return jsonify({'error': 'Missing required parameters: type, date'}), 400

    try:
        files = s3_service.list_sensor_files(sensor_type, date_str)
        # files is a list of { displayName, fileKey }
        return jsonify({'files': files})
    except ConnectionError as e:
        return jsonify({'error': str(e)}), 503 # Service Unavailable
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logging.error(f"Failed to list S3 sensor files: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred while listing sensor files.'}), 500

@app.route('/api/s3/download', methods=['POST'])
def download_s3_file():
    """Downloads a file from S3 using a fileKey."""
    data = request.get_json()
    if not data or 'fileKey' not in data:
        return jsonify({'error': 'Invalid JSON payload, missing "fileKey".'}), 400

    file_key = data['fileKey']
    sensor_type = data.get('sensor_type') # Needed to determine bucket

    if not sensor_type:
        return jsonify({'error': 'Missing required field: sensor_type'}), 400
    
    try:
        local_path = s3_service.download_parquet_file_by_key(sensor_type, file_key)
        return jsonify({
            'message': 'Download successful.',
            'local_path': local_path
        })
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except (ConnectionError, ValueError) as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        logging.error(f"Failed to download from S3: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred during download.'}), 500

@app.route('/api/s3/convert', methods=['POST'])
def convert_s3_data():
    """Processes a downloaded local file and returns simulation data."""
    data = request.get_json()
    if not data or 'local_path' not in data:
        return jsonify({'error': 'Missing local_path in request.'}), 400
    
    local_path = data['local_path']
    
    # Basic security check: ensure the path is within a designated temp folder.
    # This is crucial to prevent access to arbitrary files on the server.
    temp_dir = os.path.abspath(TEMP_FOLDER)
    if not os.path.abspath(local_path).startswith(temp_dir):
        return jsonify({'error': 'Invalid file path.'}), 400

    try:
        payload = process_parquet_file(local_path)
        return jsonify(payload)
    except FileNotFoundError:
        return jsonify({'error': 'Local file not found for conversion.'}), 404
    except Exception as e:
        logging.error(f"Failed to convert local file {local_path}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to process converted file.'}), 500

@app.route('/api/s3/move-to-local', methods=['POST'])
def move_s3_file_to_local():
    """Moves a converted/downloaded file from temp_data to data folder."""
    data = request.get_json()
    if not data or 'local_path' not in data:
        return jsonify({'error': 'Missing local_path in request.'}), 400
    local_path = os.path.abspath(data['local_path'])
    temp_dir = os.path.abspath(TEMP_FOLDER)
    data_dir = os.path.abspath(DATA_FOLDER)
    if not local_path.startswith(temp_dir + os.sep):
        return jsonify({'error': 'Invalid file path.'}), 400
    if not os.path.isfile(local_path):
        return jsonify({'error': 'File does not exist.'}), 404
    try:
        os.makedirs(data_dir, exist_ok=True)
        dest_path = os.path.join(data_dir, os.path.basename(local_path))
        # If destination exists, overwrite to keep latest
        if os.path.exists(dest_path):
            os.remove(dest_path)
        os.replace(local_path, dest_path)
        return jsonify({'message': 'Moved to local.', 'dest_path': dest_path})
    except Exception as e:
        logging.error(f"Failed to move file to local: {e}", exc_info=True)
        return jsonify({'error': 'Failed to move file to local.'}), 500

# --- Static File Serving ---
@app.route('/')
def serve_index():
    return send_from_directory(APP_ROOT, 'index.html')

@app.route('/static/<path:path>')
def serve_static_files(path):
    return send_from_directory(STATIC_FOLDER, path)

# --- Main Execution ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7003, debug=True)

