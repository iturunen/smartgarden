# Import SDK packages
from time import sleep

import boto3
import serial
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
from boto3.dynamodb.conditions import Key

import config
from utils import get_port

port_windows = config.PORT_WINDOWS
port_linux = config.PORT_LINUX
host = config.HOST
rootCAPath = config.ROOT_CA
certificatePath = config.CERTIFICATE
privateKeyPath = config.PRIVATE_KEY
table_name = config.STATUS_TABLE_NAME


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
    session = boto3.client("sts").get_caller_identity()
    print("sts.get_caller_identity: ", session)

    dynamodb = boto3.resource("dynamodb")
    print(table_name)
    table = dynamodb.Table(table_name)

    response = table.query(KeyConditionExpression=Key("id").eq("id_status"), ScanIndexForward=False)

    if not response["Items"]:
        print(f"No status found, trying again. { 5 - loopCount} tries remaining.")
        loopCount += 1
        if loopCount > 5:
            print("No status found after 5 tries. Exiting.")
            break
        continue

    items = response["Items"]
    print("Got items:", items)

    n = 1
    data = items[:n]
    if not data:
        print("No data")
        continue
    elif not data[0] or not data[0]["status"]:
        print("No data or status")
        continue
    else:
        print("Data found  ", data)
    uStatus = data[0]["status"]
    status = uStatus.encode("latin-1")
    print(status)
    ser.write(status)
    sleep(2)
