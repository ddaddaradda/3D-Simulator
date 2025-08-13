import pandas as pd
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import sys
import pytz
from datetime import datetime, timedelta
import numpy as np

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
    filtered_df = df[(df['time_kst'] >= time_window_start) & (df['time_kst'] <= time_window_end)].copy()

    # Ensure the time column is sorted for integration
    filtered_df = filtered_df.sort_values(by='time_kst').reset_index(drop=True)

    # Calculate time differences between samples in seconds
    # Convert timedelta to seconds (assuming milliseconds in original 'time' column)
    filtered_df['dt'] = filtered_df['time'].diff().fillna(0) / 1000.0

    # --- Simplified Dead Reckoning for 3D Position and Orientation ---
    # Initialize position and orientation
    positions = np.zeros((len(filtered_df), 3))
    orientations = np.zeros((len(filtered_df), 3)) # Yaw, Pitch, Roll

    # Initial velocity (assuming starting from rest or unknown, so starting at 0)
    velocities = np.zeros((len(filtered_df), 3))

    # Simple integration (Euler method - prone to drift, but good for visualization)
    for i in range(1, len(filtered_df)):
        dt = filtered_df.loc[i, 'dt']

        # Acceleration in m/s^2 (assuming raw ACCEL values are in some unit, converting to m/s^2 for simplicity)
        # A common conversion for raw accelerometer data is to divide by a sensitivity factor.
        # Here, I'll just use a scaling factor for visualization purposes.
        accel_x = filtered_df.loc[i, 'ACCEL_X'] / 16384.0 * 9.81 # Example scaling to g-forces then m/s^2
        accel_y = filtered_df.loc[i, 'ACCEL_Y'] / 16384.0 * 9.81
        accel_z = filtered_df.loc[i, 'ACCEL_Z'] / 16384.0 * 9.81

        # Update velocity
        velocities[i, 0] = velocities[i-1, 0] + accel_x * dt
        velocities[i, 1] = velocities[i-1, 1] + accel_y * dt
        velocities[i, 2] = velocities[i-1, 2] + accel_z * dt

        # Update position
        positions[i, 0] = positions[i-1, 0] + velocities[i, 0] * dt
        positions[i, 1] = positions[i-1, 1] + velocities[i, 1] * dt
        positions[i, 2] = positions[i-1, 2] + velocities[i, 2] * dt

        # Gyroscope in degrees/second, convert to radians/second for integration
        gyro_x_rad = np.deg2rad(filtered_df.loc[i, 'GYRO_X'] / 131.0) # Example scaling to deg/s
        gyro_y_rad = np.deg2rad(filtered_df.loc[i, 'GYRO_Y'] / 131.0)
        gyro_z_rad = np.deg2rad(filtered_df.loc[i, 'GYRO_Z'] / 131.0)

        # Update orientation (simplified Euler angles integration)
        # This is a very basic integration and will suffer from gimbal lock and drift.
        # For a more accurate simulation, a quaternion-based approach or Kalman filter would be needed.
        orientations[i, 0] = orientations[i-1, 0] + gyro_z_rad * dt # Yaw
        orientations[i, 1] = orientations[i-1, 1] + gyro_x_rad * dt # Pitch
        orientations[i, 2] = orientations[i-1, 2] + gyro_y_rad * dt # Roll

    # Plotting ACCEL, GYRO, PITCH, ROLL data (existing plots)
    plt.figure(figsize=(12, 6))
    plt.plot(filtered_df['time_kst'], filtered_df['ACCEL_X'], label='ACCEL_X')
    plt.plot(filtered_df['time_kst'], filtered_df['ACCEL_Y'], label='ACCEL_Y')
    plt.plot(filtered_df['time_kst'], filtered_df['ACCEL_Z'], label='ACCEL_Z')
    plt.xlabel('Time (KST)')
    plt.ylabel('Acceleration')
    plt.title('Acceleration Data (2025-08-06 18:02:10 to 18:22:10)')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig('accel_data.png')
    plt.close()

    plt.figure(figsize=(12, 6))
    plt.plot(filtered_df['time_kst'], filtered_df['GYRO_X'], label='GYRO_X')
    plt.plot(filtered_df['time_kst'], filtered_df['GYRO_Y'], label='GYRO_Y')
    plt.plot(filtered_df['time_kst'], filtered_df['GYRO_Z'], label='GYRO_Z')
    plt.xlabel('Time (KST)')
    plt.ylabel('Gyroscope')
    plt.title('Gyroscope Data (2025-08-06 18:02:10 to 18:22:10)')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig('gyro_data.png')
    plt.close()

    plt.figure(figsize=(12, 6))
    plt.plot(filtered_df['time_kst'], filtered_df['PITCH'], label='PITCH')
    plt.plot(filtered_df['time_kst'], filtered_df['ROLL'], label='ROLL')
    plt.xlabel('Time (KST)')
    plt.ylabel('Angle (degrees)')
    plt.title('Pitch and Roll Data (2025-08-06 18:02:10 to 18:22:10)')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig('pitch_roll_data.png')
    plt.close()

    # --- 3D Plotting of Estimated Path and Orientation ---
    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(111, projection='3d')

    # Plot the estimated path
    ax.plot(positions[:, 0], positions[:, 1], positions[:, 2], label='Estimated Wheelchair Path')

    # Add orientation indicators (e.g., arrows) at intervals
    # This is a simplified representation. For true orientation, you'd need rotation matrices.
    num_arrows = 20 # Number of arrows to display
    step = max(1, len(positions) // num_arrows)

    for i in range(0, len(positions), step):
        x, y, z = positions[i, 0], positions[i, 1], positions[i, 2]
        yaw, pitch, roll = orientations[i, 0], orientations[i, 1], orientations[i, 2]

        # Create a simple arrow representing forward direction (e.g., along X-axis initially)
        # Rotate this arrow based on estimated yaw, pitch, roll
        # This is a very simplified visualization of orientation.
        # For a more accurate representation, you'd need to apply 3D rotation matrices.
        arrow_length = 0.5 # Adjust as needed
        # Simple forward vector (initially along x-axis)
        dx = arrow_length * np.cos(yaw) * np.cos(pitch)
        dy = arrow_length * np.sin(yaw) * np.cos(pitch)
        dz = arrow_length * np.sin(pitch)

        ax.quiver(x, y, z, dx, dy, dz, color='r', length=arrow_length, arrow_length_ratio=0.3)

    ax.set_xlabel('X Position')
    ax.set_ylabel('Y Position')
    ax.set_zlabel('Z Position')
    ax.set_title('Estimated 3D Wheelchair Path and Orientation')
    ax.legend()
    ax.grid(True)
    plt.tight_layout()
    plt.savefig('wheelchair_3d_path.png')
    plt.close()

    print("Plots saved as accel_data.png, gyro_data.png, pitch_roll_data.png, and wheelchair_3d_path.png")

except Exception as e:
    print(f"Error reading or processing parquet file: {e}")
    sys.exit(1)