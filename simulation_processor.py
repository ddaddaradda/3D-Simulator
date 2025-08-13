
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
    calculated_orientations = np.zeros((len(df), 3))  # yaw, pitch, roll
    
    gyro_sensitivity = config.GYRO_SENSITIVITY

    for i in range(1, len(df)):
        dt = float(df.loc[i, 'dt'])
        gyro_x_rad = float(np.deg2rad(df.loc[i, 'GYRO_X'] / gyro_sensitivity))
        gyro_y_rad = float(np.deg2rad(df.loc[i, 'GYRO_Y'] / gyro_sensitivity))
        gyro_z_rad = float(np.deg2rad(df.loc[i, 'GYRO_Z'] / gyro_sensitivity))
        
        # Update orientations
        calculated_orientations[i, 0] = calculated_orientations[i - 1, 0] + gyro_z_rad * dt  # yaw
        calculated_orientations[i, 1] = calculated_orientations[i - 1, 1] + gyro_x_rad * dt  # pitch
        calculated_orientations[i, 2] = calculated_orientations[i - 1, 2] + gyro_y_rad * dt  # roll

    df['calculated_yaw'] = calculated_orientations[:, 0]
    df['calculated_pitch'] = calculated_orientations[:, 1]
    df['calculated_roll'] = calculated_orientations[:, 2]

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
