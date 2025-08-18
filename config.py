"""
Configuration values for the wheelchair simulation application.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# --- Application Setup ---
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_FOLDER = os.path.join(APP_ROOT, 'static')
DATA_FOLDER = os.path.join(APP_ROOT, 'data')
TEMP_FOLDER = os.path.join(APP_ROOT, 'temp_data')

# --- Server Configuration ---
DEBUG = True  # Set to False in production
PORT = 7003


# --- Simulation Parameters ---
GYRO_SENSITIVITY = 131.0  # Gyroscope sensitivity factor

# --- AWS S3 Configuration ---
S3_BUCKET_BLE = os.getenv('S3_BUCKET_BLE')
S3_BUCKET_LTE = os.getenv('S3_BUCKET_LTE')

