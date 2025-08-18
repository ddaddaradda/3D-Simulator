import os
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

import pandas as pd
from flask import Blueprint, jsonify, request, current_app

from simulation_processor import process_parquet_file

local_api = Blueprint('local_api', __name__)

# --- Helper Functions (moved from api_server.py) ---

def _list_parquet_files() -> List[Dict[str, Any]]:
    """Return a list of parquet files in DATA_FOLDER with metadata."""
    data_folder = current_app.config['DATA_FOLDER']
    if not os.path.isdir(data_folder):
        logging.warning(f"Data folder not found at: {data_folder}")
        return []
    
    files: List[Dict[str, Any]] = []
    for name in os.listdir(data_folder):
        if not name.lower().endswith('.parquet'):
            continue
        path = os.path.join(data_folder, name)
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
    
    data_root = os.path.abspath(current_app.config['DATA_FOLDER'])
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

@local_api.route('/files')
def list_files_route():
    """List available parquet files under the data folder."""
    files = _list_parquet_files()
    return jsonify({'files': files})

@local_api.route('/local/delete', methods=['POST'])
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

@local_api.route('/data')
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
