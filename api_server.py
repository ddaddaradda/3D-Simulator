

from flask import Flask, jsonify, send_from_directory, current_app
from flask_cors import CORS
import logging
from dotenv import load_dotenv

from services.s3_service import S3Service
from api.local_api import local_api
from api.s3_api import s3_api

# Load environment variables from .env file
load_dotenv()

"""
Main Flask API server for the wheelchair orientation simulation.
Initializes the Flask app, registers blueprints, and defines static file serving.
"""

# --- Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize Flask App
app = Flask(__name__)
app.config.from_object('config')
CORS(app)

# Initialize services
s3_service = S3Service()
app.s3_service = s3_service

# Register Blueprints
app.register_blueprint(local_api, url_prefix='/api')
app.register_blueprint(s3_api, url_prefix='/api')


# --- Error Handling ---
@app.errorhandler(Exception)
def handle_generic_exception(e):
    """Catch all unhandled exceptions."""
    logging.error(f"An unhandled exception occurred: {e}", exc_info=True)
    return jsonify({'error': 'An unexpected server error occurred.'}), 500


# --- Static File Serving ---
@app.route('/')
def serve_index():
    """Serves the main index.html file."""
    return send_from_directory(current_app.config['APP_ROOT'], 'index.html')

@app.route('/static/<path:path>')
def serve_static_files(path):
    """Serves static files from the 'static' directory."""
    return send_from_directory(current_app.config['STATIC_FOLDER'], path)


# --- Main Execution ---
if __name__ == '__main__':
    app.run(
        host='0.0.0.0', 
        port=app.config.get('PORT', 7003), 
        debug=app.config.get('DEBUG', False)
    )

