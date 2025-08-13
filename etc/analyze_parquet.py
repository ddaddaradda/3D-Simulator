import pandas as pd
import sys
import pytz
from datetime import datetime, timedelta

file_path = sys.argv[1]

try:
    df = pd.read_parquet(file_path)

    # Convert 'time' column from Unix milliseconds to datetime objects (KST)
    df['time_kst'] = pd.to_datetime(df['time'], unit='ms')
    kst = pytz.timezone('Asia/Seoul')
    df['time_kst'] = df['time_kst'].dt.tz_localize(pytz.utc).dt.tz_convert(kst)

    # Define the target time and time window
    target_time_str = '2025-08-06 18:12:10'
    target_time = kst.localize(datetime.strptime(target_time_str, '%Y-%m-%d %H:%M:%S'))
    time_window_start = target_time - timedelta(minutes=10)
    time_window_end = target_time + timedelta(minutes=10)

    # Filter data within the 20-minute window
    filtered_df = df[(df['time_kst'] >= time_window_start) & (df['time_kst'] <= time_window_end)]

    print("Column Information (Filtered Data):")
    print(filtered_df.info())
    print("\nSample Data (first 5 rows of filtered data):")
    print(filtered_df.head().to_markdown(index=False))

    # Extract relevant columns for simulation/visualization
    simulation_data = filtered_df[['time_kst', 'ACCEL_X', 'ACCEL_Y', 'ACCEL_Z', 'GYRO_X', 'GYRO_Y', 'GYRO_Z', 'PITCH', 'ROLL']]
    print("\nSimulation Data (first 5 rows):")
    print(simulation_data.head().to_markdown(index=False))

except Exception as e:
    print(f"Error reading or processing parquet file: {e}")
    sys.exit(1)