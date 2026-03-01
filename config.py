import json
import os

import boto3
from dotenv import load_dotenv

secretsmanager = boto3.client("secretsmanager")

load_dotenv()


PORT_WINDOWS = os.getenv("PORT_WINDOWS")
PORT_LINUX = os.getenv("PORT_LINUX")
iot_credentials_secret_name = os.getenv("IOT_CREDENTIALS_SECRET_NAME")

iot_credentials_secret = secretsmanager.get_secret_value(SecretId=iot_credentials_secret_name)
iot_credentials = iot_credentials_secret["SecretString"]
iot_credentials = json.loads(iot_credentials)

CERTIFICATE = iot_credentials["certificate"]
PRIVATE_KEY = iot_credentials["privateKey"]
ROOT_CA = iot_credentials["rootCertificate"]
HOST = iot_credentials["host"]

if not CERTIFICATE or not PRIVATE_KEY or not ROOT_CA or not HOST:
    raise ValueError("Missing environment variables for IoT credentials")


READINGS_TABLE_NAME = os.getenv("READINGS_TABLE_NAME")
STATUS_TABLE_NAME = os.getenv("STATUS_TABLE_NAME")
LOGIN_TABLE_NAME = os.getenv("LOGIN_TABLE_NAME")

if not READINGS_TABLE_NAME or not STATUS_TABLE_NAME or not LOGIN_TABLE_NAME:
    raise ValueError("Missing environment variables for DynamoDB tables")
