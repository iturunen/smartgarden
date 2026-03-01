# smartgarden :seedling:
## Internet of Things (IoT) Smart Garden
### _Singapore Polytechnic (Diploma in Business IT) Year 3 IoT Project_

Check out the detailed step-by-step tutorial [here](https://www.hackster.io/mokxf16/smart-garden-raspberry-pi-arduino-65c7b7)

The smart garden monitors the temperature :thermometer:, humidity :droplet:, light levels :sun_with_face: and soil moisture :seedling: of the plant. It has an automated system that waters the plant when the soil is too dry and switches on the light when it is too dark. This maintains an ideal and consistent soil condition for the plant, and makes it convenient for those who tend to forget to water their plants regularly. Also, the plant can continuously photosynthesize even when there is no sunlight.

We will be using an **Arduino** and a **Raspberry Pi** to receive data from sensors and control the different actuators. The surrounding temperature, air humidity and brightness values will be recorded, as well as the soil moisture levels. These values will then be displayed on the LCD screen, which allow users to know the environmental conditions of the plants when they check on them.

When the soil moisture level goes above 500 (for our soil moisture sensor, the higher it is the drier the soil), the red LED will light up as a warning to show that the plant needs water. Also the water pump will start to run and pump water into the soil automatically. This is very convenient for users as they do not need to water their plants every time but instead let the system water their plants automatically based on the moisture level of the soil. As for the automated light, when the LDR records a value higher than 300, the yellow LED will light up and act like the sun, to allow continuous photosynthesis to occur for the plants.

The temperature, humidity, light levels and soil moisture values will also be published to DynamoDB. Through a server (Raspberry Pi), the data will be displayed onto a flask web page where it shows real-time data coming from the sensors. This will allow users to view the real-time environmental conditions of the plants on the go (the latest 15 records through a graph).

The web page will also allow users to control the water pump and decide whether they wish to water the plants automatically or manually. They can turn on or off the water pump whenever they wish to, thus making it very convenient if users wish to water their plants even when they are not around.

## Requirements :computer:
* Python 3.0
* Arduino
* Raspberry Pi
* Amazon Web Services
* DynamoDB
* Flask
* Sensors (temperature, humidity, light levels and soil moisture)
* Your plant 🌱

## Steps 📖
1. Set up hardware
2. Install required packages and libraries on your Raspberry Pi
3. Set up Amazon Web Services Account
4. Set up DynamoDB
5. Code the application
6. Run Arduino code
7. Start up web page
8. Use your smart garden! 🌱


## Images 📷
Final set up:

![Final setup](https://user-images.githubusercontent.com/38778609/111861169-35bb7500-8987-11eb-99ca-5d8c80796d1d.png)

#### Web page
Dashboard:

![Dashboard](https://user-images.githubusercontent.com/38778609/111861192-5d124200-8987-11eb-9ea9-3233efa1a000.png)

Graph:

![Graph](https://user-images.githubusercontent.com/38778609/111861235-a793be80-8987-11eb-8d69-3b1314753eb9.png)

## SmartGarden (local run + AWS CDK deploy)

This repository contains:
- A **Flask web UI + API** that reads/writes data in **DynamoDB**
- Optional **device-side scripts**:
  - publish readings to **AWS IoT Core** (`smartgarden/readings`)
  - poll latest status from **DynamoDB** and forward it to a serial device
- An **AWS CDK (TypeScript)** project that deploys the required AWS resources (DynamoDB, IoT rules, Secrets, Lambda custom resource).

---

## Repository layout

- `flaskapp/` – Flask app (routes, templates integration)
- `server.py` – starts Flask
- `aws_pubsub_readings.py` – reads serial data and publishes to IoT topic `smartgarden/readings`
- `aws_pubsub_status.py` – polls DynamoDB status and writes it to serial
- `config.py` – loads `.env`, fetches IoT credentials from Secrets Manager, validates table env vars
- `dynamodb.py` – DynamoDB access layer used by Flask routes
- `infra/` – AWS CDK (TypeScript) project
  - `bin/infra.ts` – CDK app entrypoint (creates stacks)
  - `lib/data-pipeline-stack.ts` – DynamoDB tables + IoT topic rules + admin user init
  - `lib/secrets-stack.ts` – Secrets Manager secret for IoT cert bundle (seeded from local files)
  - `lambda-functions/init-users.ts` – custom resource Lambda to initialize admin user

---

## High-level architecture

### Data flow: readings
1. Device script publishes JSON messages to AWS IoT topic: `smartgarden/readings`.
2. IoT Core **Topic Rule** writes the message into the DynamoDB readings table:
   - table name pattern: `<stackName>-readings`

### Data flow: status
1. Web UI (Flask) can write a new status value into the DynamoDB status table.
2. Device script (`aws_pubsub_status.py`) polls DynamoDB for the latest status and pushes it over serial.

### Authentication / users
- A DynamoDB users table is created by CDK.
- A Secrets Manager secret is created containing `{ username, password }` for an admin user.
- A Lambda-backed CDK Custom Resource writes the admin user into the users table on deploy.

---

## Prerequisites

### Local development
- Python **3.10+**
- `make` (optional but recommended)
- AWS credentials available locally (profile or env vars), because the app fetches secrets and tables from AWS

### Infrastructure (CDK)
- Node.js **18–22** and npm **10+** (matches `infra/package.json` engines)
- AWS CLI v2
- Permissions to use:
  - CloudFormation, IAM, DynamoDB, IoT Core, Lambda, Secrets Manager, S3 (for CDK assets)

---

## Configuration (.env)

The application reads configuration from a `.env` file in the repository root.

Minimum required variables:

```dotenv
# Serial ports
PORT_WINDOWS=COM4
PORT_LINUX=/dev/ttyUSB0

# AWS resources (names must match what CDK created)
IOT_CREDENTIALS_SECRET_NAME=...
READINGS_TABLE_NAME=...
STATUS_TABLE_NAME=...
LOGIN_TABLE_NAME=...


