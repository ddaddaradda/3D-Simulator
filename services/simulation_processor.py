
import pandas as pd
import numpy as np
from typing import Dict, Any

import config

def process_parquet_file(file_path: str) -> Dict[str, Any]:
    """
    Load a parquet file and compute simulation data structure.

    Args:
        file_path: The absolute path to the parquet file.

    Returns:
        A dictionary containing 'calculated' and 'original' orientation data.
    """
    df = pd.read_parquet(file_path)
    df = df.sort_values(by='time').reset_index(drop=True)

    # Calculated by integrating gyro (simple integration)
    df['dt'] = df['time'].diff().fillna(0) / 1000.0
    # Vectorized calculation
    gyro_sensitivity = config.GYRO_SENSITIVITY
    
    # Convert gyro data to radians
    gyro_x_rad = np.deg2rad(df['GYRO_X'].values / gyro_sensitivity)
    gyro_y_rad = np.deg2rad(df['GYRO_Y'].values / gyro_sensitivity)
    gyro_z_rad = np.deg2rad(df['GYRO_Z'].values / gyro_sensitivity)
    dt = df['dt'].values

    # Integrate (Cumulative Sum)
    # yaw (z), pitch (x), roll (y)
    # Use cumsum to integrate angular velocity * dt
    yaw = np.cumsum(gyro_z_rad * dt)
    pitch = np.cumsum(gyro_x_rad * dt)
    roll = np.cumsum(gyro_y_rad * dt)

    df['calculated_yaw'] = yaw
    df['calculated_pitch'] = pitch
    df['calculated_roll'] = roll

    # Original (deg -> rad), yaw assumed 0
    df['original_pitch'] = np.deg2rad(df['PITCH'])
    df['original_roll'] = np.deg2rad(df['ROLL'])
    df['original_yaw'] = 0

    # Prepare final dataframes
    calculated_df = df[['time', 'calculated_pitch', 'calculated_roll', 'calculated_yaw']].rename(
        columns={'calculated_pitch': 'pitch', 'calculated_roll': 'roll', 'calculated_yaw': 'yaw'}
    )
    original_df = df[['time', 'original_pitch', 'original_roll', 'original_yaw']].rename(
        columns={'original_pitch': 'pitch', 'original_roll': 'roll', 'original_yaw': 'yaw'}
    )

    return {
        'calculated': calculated_df.to_dict(orient='records'),
        'original': original_df.to_dict(orient='records'),
    }
