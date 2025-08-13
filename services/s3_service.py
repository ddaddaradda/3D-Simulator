import os
import logging
from typing import List, Optional, Dict

import boto3
from botocore.exceptions import NoCredentialsError, ClientError

import config

class S3Service:
    """A service class for interacting with AWS S3."""

    def __init__(self):
        """Initializes the S3 client."""
        try:
            self.s3_client = boto3.client('s3')
        except NoCredentialsError:
            logging.error("AWS credentials not found. Please configure them.")
            self.s3_client = None

    def _get_bucket_name(self, sensor_type: str) -> Optional[str]:
        """Returns the appropriate S3 bucket name based on sensor type."""
        if sensor_type == 'ble':
            return config.S3_BUCKET_BLE
        elif sensor_type == 'LTE':
            return config.S3_BUCKET_LTE
        return None

    def list_sensor_files(self, sensor_type: str, date: str) -> List[Dict[str, str]]:
        """
        Lists files from S3, returning both a display name and the full file key.

        Args:
            sensor_type: The type of sensor ('ble' or 'LTE').
            date: The date string in 'YYYY-MM-DD' format.

        Returns:
            A list of dictionaries, each containing 'displayName' and 'fileKey'.
        """
        if not self.s3_client:
            raise ConnectionError("S3 client is not initialized.")

        bucket_name = self._get_bucket_name(sensor_type)
        if not bucket_name:
            raise ValueError(f"Invalid sensor type: {sensor_type}")

        prefix = date.replace('-', '') + '/'
        files_info: List[Dict[str, str]] = []
        
        logging.info(f"Listing objects in bucket '{bucket_name}' with prefix '{prefix}'")

        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket_name, Prefix=prefix)
            for page in pages:
                if 'Contents' not in page:
                    continue
                for obj in page['Contents']:
                    file_key = obj['Key']
                    filename = os.path.basename(file_key)
                    if filename.endswith('.parquet'):
                        try:
                            # Extract sensor_id as display name
                            display_name = filename.split('_')[0]
                            files_info.append({
                                'displayName': display_name,
                                'fileKey': file_key 
                            })
                        except IndexError:
                            logging.warning(f"Could not parse filename '{filename}'. Skipping.")
            
            logging.info(f"Found {len(files_info)} valid parquet files.")
            return files_info

        except ClientError as e:
            logging.error(f"An S3 error occurred: {e.response['Error']['Message']}")
            raise

    def download_parquet_file_by_key(self, sensor_type: str, file_key: str) -> str:
        """
        Downloads a parquet file from S3 using its full file key.

        Args:
            sensor_type: The type of sensor, used to determine the bucket.
            file_key: The full key of the file in the S3 bucket.

        Returns:
            The local path to the downloaded file.
        """
        if not self.s3_client:
            raise ConnectionError("S3 client is not initialized.")

        bucket_name = self._get_bucket_name(sensor_type)
        if not bucket_name:
            raise ValueError(f"Invalid sensor type: {sensor_type}")

        local_dir = 'temp_data'
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, os.path.basename(file_key))

        logging.info(f"Attempting to download s3://{bucket_name}/{file_key} to {local_path}")

        try:
            self.s3_client.download_file(bucket_name, file_key, local_path)
            logging.info("Download successful.")
            return local_path
        except ClientError as e:
            logging.error(f"Failed to download file: {e.response['Error']['Message']}")
            if e.response['Error']['Code'] == '404':
                raise FileNotFoundError(f"File not found on S3: {file_key}")
            raise
