import os
import logging

from flask import Blueprint, jsonify, request, current_app

from simulation_processor import process_parquet_file

s3_api = Blueprint('s3_api', __name__)


@s3_api.route('/s3/sensors')
def list_s3_sensors():
    """Lists available sensor files from S3 for a given type and date."""
    sensor_type = request.args.get('type')
    date_str = request.args.get('date')

    if not sensor_type or not date_str:
        return jsonify({'error': 'Missing required parameters: type, date'}), 400

    try:
        files = current_app.s3_service.list_sensor_files(sensor_type, date_str)
        return jsonify({'files': files})
    except ConnectionError as e:
        return jsonify({'error': str(e)}), 503 # Service Unavailable
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@s3_api.route('/s3/download', methods=['POST'])
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
        local_path = current_app.s3_service.download_parquet_file_by_key(
            sensor_type, 
            file_key,
            current_app.config['TEMP_FOLDER']
        )
        return jsonify({
            'message': 'Download successful.',
            'local_path': local_path
        })
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except (ConnectionError, ValueError) as e:
        return jsonify({'error': str(e)}), 500

@s3_api.route('/s3/convert', methods=['POST'])
def convert_s3_data():
    """Processes a downloaded local file and returns simulation data."""
    data = request.get_json()
    if not data or 'local_path' not in data:
        return jsonify({'error': 'Missing local_path in request.'}), 400
    
    local_path = data['local_path']
    
    temp_dir = os.path.abspath(current_app.config['TEMP_FOLDER'])
    if not os.path.abspath(local_path).startswith(temp_dir):
        return jsonify({'error': 'Invalid file path.'}), 400

    try:
        payload = process_parquet_file(local_path)
        return jsonify(payload)
    except FileNotFoundError:
        return jsonify({'error': 'Local file not found for conversion.'}), 404

@s3_api.route('/s3/move-to-local', methods=['POST'])
def move_s3_file_to_local():
    """Moves a converted/downloaded file from temp_data to data folder."""
    data = request.get_json()
    if not data or 'local_path' not in data:
        return jsonify({'error': 'Missing local_path in request.'}), 400
    local_path = os.path.abspath(data['local_path'])
    temp_dir = os.path.abspath(current_app.config['TEMP_FOLDER'])
    data_dir = os.path.abspath(current_app.config['DATA_FOLDER'])
    if not local_path.startswith(temp_dir + os.sep):
        return jsonify({'error': 'Invalid file path.'}), 400
    if not os.path.isfile(local_path):
        return jsonify({'error': 'File does not exist.'}), 404

    os.makedirs(data_dir, exist_ok=True)
    dest_path = os.path.join(data_dir, os.path.basename(local_path))
    if os.path.exists(dest_path):
        os.remove(dest_path)
    os.replace(local_path, dest_path)
    return jsonify({'message': 'Moved to local.', 'dest_path': dest_path})
