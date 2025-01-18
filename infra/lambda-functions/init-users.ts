import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  CloudFormationCustomResourceUpdateEvent,
} from "aws-lambda";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import * as https from "https";
import * as url from "url";


const secretsManager = new SecretsManagerClient();
const dynamoDB = new DynamoDBClient();

exports.handler = async (event: CloudFormationCustomResourceEvent): Promise<void> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const loginSecretArn = process.env.LOGIN_SECRET_ARN;
  const tableName = process.env.TABLE_NAME;

  if (!event.RequestType || !loginSecretArn || !tableName) {
    throw new Error("Invalid event: Missing RequestType");
  }

  try {
    switch (event.RequestType) {
      case "Create":
        await handleCreate(event as CloudFormationCustomResourceCreateEvent, loginSecretArn, tableName);
        break;

      case "Update":
        await handleUpdate(event as CloudFormationCustomResourceUpdateEvent, loginSecretArn, tableName);
        break;

      case "Delete":
        await handleDelete(event as CloudFormationCustomResourceDeleteEvent);
        break;

      default:
        throw new Error(`Unknown RequestType: ${event}`);
    }

    await sendResponse(event, "SUCCESS", "Operation completed successfully");
  } catch (error) {
    console.error("Error handling event:", error);
    await sendResponse(event, "FAILED", error.message || "Unknown error");
  }
};

async function handleCreate(event: CloudFormationCustomResourceCreateEvent, loginSecretArn: string, tableName: string): Promise<void> {
  console.log("Handling Create event...");

  // Fetch secret from Secrets Manager
  const secretValue = await fetchUserSecret(loginSecretArn);

  if (!secretValue) {
    throw new Error("Invalid secret value");
  }
  const params = {
    TableName: tableName,
    Key: {
      username: { S: secretValue.username },
    },
    UpdateExpression: "SET password = :password",
    ExpressionAttributeValues: {
      ":password": { S: secretValue.password },
    },
  };
  await dynamoDB.send(new UpdateItemCommand(params));
  console.log("User updated in DynamoDB");
}

async function handleUpdate(event: CloudFormationCustomResourceUpdateEvent, loginSecretArn: string, tableName: string): Promise<void> {
  console.log("Handling Update event...");
  const secretValue = await fetchUserSecret(loginSecretArn);
  if (!secretValue) {
    throw new Error("Invalid secret value");
  }
  const params = {
    TableName: tableName,
    Item: {
      username: { S: secretValue.username },
      password: { S: secretValue.password },
    },
  };
  await dynamoDB.send(new UpdateItemCommand(params));


}

async function fetchUserSecret(secretArn: string): Promise<{ username: string; password: string } | undefined> {
  const secret = await secretsManager.send(new GetSecretValueCommand({ SecretId: process.env.LOGIN_SECRET_ARN }));
  if (!secret.SecretString) return;
  const secretValue = JSON.parse(secret.SecretString || "{}");
  if (!secretValue.username || !secretValue.password)
    return;
  return secretValue;
};


async function handleDelete(event: CloudFormationCustomResourceDeleteEvent): Promise<void> {
  console.log("Handling Delete event...");
  // Add logic for deletes if needed
  console.log("Delete event logic is currently not implemented.");
}

async function sendResponse(
  event: CloudFormationCustomResourceEvent,
  status: string,
  reason: string
): Promise<void> {
  const responseBody = {
    Status: status,
    Reason: reason,
    PhysicalResourceId: event.PhysicalResourceId || "CustomResourceHandler",
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {},
  };

  console.log("Response body:", JSON.stringify(responseBody, null, 2));

  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "Content-Type": "",
      "Content-Length": Buffer.byteLength(JSON.stringify(responseBody)),
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      console.log(`Response status code: ${response.statusCode}`);
      resolve();
    });

    request.on("error", (error) => {
      console.error("Error sending response:", error);
      reject(error);
    });

    request.write(JSON.stringify(responseBody));
    request.end();
  });
}