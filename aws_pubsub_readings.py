# Import SDK packages
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
import serial
#from rpi_lcd import LCD
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

port = get_port(port_windows, port_linux)


# Get serial to fetch data from arduino
ser = serial.Serial(port, 9600)


    
#lcd = LCD()

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
print("Connecting")
my_rpi.connect()
my_rpi.subscribe("smartgarden/readings", 1, customCallback)
#lcd.text("  SMART GARDEN  ", 1)
#lcd.text("* Welcome back *", 2)
sleep(2)
#lcd.clear()

# Publish to the same topic in a loop forever
loopCount = 0
while True:
	print("Going read a lines")
	temp = float(ser.readline())
	hum = float(ser.readline())
	soil = float(ser.readline())
	light = float(ser.readline())

	print("Read all lines")
	print("Temperature: ", temp)
	print("Humidity: ", hum)
	print("Moisture: ", soil)
	print("Light: ", light)

	#lcd.text('Humidity: {:.2f}%'.format(hum), 1)
	#lcd.text('Temp: {:.2f} C'.format(temp), 2)
	sleep(2)
	#lcd.clear()

	#lcd.text('Moisture: {:d}'.format(soil), 1)
	#lcd.text('Light Level: {:d} C'.format(light), 2)
	sleep(2)
	#lcd.clear()

	loopCount = loopCount+1
	message = {}
	message["id"] = "id_smartgarden"
	import datetime as datetime
	now = datetime.datetime.now()
	message["datetimeid"] = now.isoformat()      
	message["temperature"] = temp
	message["humidity"] = hum
	message["moisture"] = soil
	message["light"] = light
	import json
	print("Publishing")
	my_rpi.publish("smartgarden/readings", json.dumps(message), 1)
