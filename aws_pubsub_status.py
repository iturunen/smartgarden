# Import SDK packages
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
import boto3
from boto3.dynamodb.conditions import Key
import jsonconverter as jsonc
import serial
from time import sleep
from dotenv import load_dotenv
import os

from utils import get_port

# Load environment variables from .env file
load_dotenv()

# Get environment variables
port_windows = os.getenv('PORT_WINDOWS')
port_linux = os.getenv('PORT_LINUX')
host = os.getenv('HOST')
rootCAPath = os.getenv('ROOT_CA_PATH')
certificatePath = os.getenv('CERTIFICATE_PATH')
privateKeyPath = os.getenv('PRIVATE_KEY_PATH')
table_name = os.getenv('TABLE_NAME')

# Get port
port = get_port(port_windows, port_linux)

# Get serial to fetch data from arduino
ser = serial.Serial(port, 9600)

def customCallback(client, userdata, message):
    print("Received a new message: ")
    print(message.payload)
    print("from topic: ")
    print(message.topic)
    print("--------------\n\n")
    
my_rpi = AWSIoTMQTTClient("basicPubSub")
my_rpi.configureEndpoint(host, 8883)
my_rpi.configureCredentials(rootCAPath, privateKeyPath, certificatePath)

my_rpi.configureOfflinePublishQueueing(-1)  # Infinite offline Publish queueing
my_rpi.configureDrainingFrequency(2)  # Draining: 2 Hz
my_rpi.configureConnectDisconnectTimeout(10)  # 10 sec
my_rpi.configureMQTTOperationTimeout(5)  # 5 sec

# Connect and subscribe to AWS IoT
my_rpi.connect()
my_rpi.subscribe("smartgarden/status", 1, customCallback)
sleep(2)

# Publish to the same topic in a loop forever
loopCount = 0
while True:
    # check with boto that the caller identity ok and can access the table
    session = boto3.client('sts').get_caller_identity()
    print("sts.get_caller_identity: ", session)

    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    response = table.query(KeyConditionExpression=Key('id').eq('id_status'), ScanIndexForward=False)

    items = response['Items']
    print("Got items:", items)

    n = 1
    data = items[:n]
    if not data:
        print("No data")
        continue
    elif not data[0] or not data[0]['status']:
        print("No data or status")
        continue
    else:
        print("Data found  ", data)
    uStatus = data[0]['status']
    status = uStatus.encode('latin-1')
    print(status)
    ser.write(status)
    sleep(2)
