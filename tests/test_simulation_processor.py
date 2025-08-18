import os
import pandas as pd
import pytest
from simulation_processor import process_parquet_file

@pytest.fixture
def temp_parquet_file(tmp_path):
    """Create a temporary parquet file for testing."""
    data = {
        'time': [1000, 2000, 3000],
        'GYRO_X': [10, 20, 30],
        'GYRO_Y': [15, 25, 35],
        'GYRO_Z': [5, 5, 5],
        'PITCH': [1.0, 1.1, 1.2],
        'ROLL': [-0.5, -0.6, -0.7],
    }
    df = pd.DataFrame(data)
    file_path = tmp_path / "test_data.parquet"
    df.to_parquet(file_path)
    return str(file_path)

def test_process_parquet_file_smoke(temp_parquet_file):
    """A smoke test to ensure the function runs and returns the correct structure."""
    # Act
    result = process_parquet_file(temp_parquet_file)

    # Assert
    assert isinstance(result, dict)
    assert 'calculated' in result
    assert 'original' in result
    assert isinstance(result['calculated'], list)
    assert isinstance(result['original'], list)
    assert len(result['original']) == 3
    assert len(result['calculated']) == 3

def test_process_parquet_file_columns(temp_parquet_file):
    """Test that the processed dataframes have the correct columns."""
    # Act
    result = process_parquet_file(temp_parquet_file)

    # Assert
    for item in result['original']:
        assert set(item.keys()) == {'time', 'pitch', 'roll', 'yaw'}
    
    for item in result['calculated']:
        assert set(item.keys()) == {'time', 'pitch', 'roll', 'yaw'}
